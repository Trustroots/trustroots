import type { Types } from 'mongoose';

const mongoose: typeof import('mongoose') = require('mongoose');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');

type Request = Record<string, unknown>;
type Result = { statusCode: number; body: unknown };
type Handler = (req: Request, res: unknown) => Promise<unknown>;
type Upload = (req: unknown, res: unknown, next: () => void) => void;
// Loaded lazily, inside the first test that runs, so Stryker credits the
// module-level constants to that test instead of ignoring them as static.
const controller = new Proxy({} as Record<string, unknown>, {
  get: (_target, key: string) =>
    require('../../server/controllers/admin.newsletter.server.controller.mts')[
      key
    ],
}) as unknown as Record<
  'list' | 'listCircleMembers' | 'audience' | 'splitSubscribers',
  Handler
> & { uploadSubscribersCsv: Upload };

async function call(handler: Handler, req: Request): Promise<Result> {
  const result: Result = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    set() {
      return res;
    },
    send(body: unknown) {
      result.body = body;
      return res;
    },
  };
  await handler(req, res);
  return result;
}

describe('Admin newsletter controller audiences', () => {
  const User = mongoose.model('User');
  const Offer = mongoose.model('Offer');
  const circle = new mongoose.Types.ObjectId();
  let seq = 0;

  afterEach(async () => {
    await utils.clearDatabase();
  });

  async function addUser(fields: Record<string, unknown> = {}) {
    seq += 1;
    const user = {
      _id: new mongoose.Types.ObjectId(),
      username: `fictional${seq}`,
      displayName: `Fictional ${seq}`,
      firstName: 'Fictional',
      lastName: `Member${seq}`,
      email: `member${seq}@example.test`,
      public: true,
      newsletter: true,
      roles: ['user'],
      ...fields,
    };
    await User.collection.insertOne(user);
    return user as typeof user & { _id: Types.ObjectId };
  }

  const audience = (body: Record<string, unknown>) =>
    call(controller.audience, { body });
  const count = async (body: Record<string, unknown>) => {
    const result = await audience(body);
    assert.equal(result.statusCode, 200, JSON.stringify(result.body));
    return (result.body as { count: number }).count;
  };
  const rejection = async (body: Record<string, unknown>) => {
    const result = await audience(body);
    assert.equal(result.statusCode, 400, JSON.stringify(body));
    return (result.body as { message: string }).message;
  };

  const { Readable }: typeof import('node:stream') = require('node:stream');
  type Received = {
    passed: boolean;
    result: Result;
    file?: { buffer: Buffer };
  };
  function upload(field: string, filename: string, content: string) {
    const boundary = '----fictional-boundary';
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${field}"; filename="${filename}"`,
      'Content-Type: text/plain',
      '',
      content,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const req = Object.assign(Readable.from([body]), {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(Buffer.byteLength(body)),
      },
    }) as unknown as { file?: Received['file'] };
    return new Promise<Received>(resolve => {
      const result: Result = { statusCode: 200, body: undefined };
      const res = {
        status(code: number) {
          result.statusCode = code;
          return res;
        },
        send(sent: unknown) {
          result.body = sent;
          resolve({ passed: false, result });
          return res;
        },
      };
      controller.uploadSubscribersCsv(req, res, () =>
        resolve({ passed: true, result, file: req.file }),
      );
    });
  }
  type Split = {
    totalEmailCount: number;
    subscribedContent: string;
    unsubscribedContent: string;
    outputFormat: string;
  };
  const split = async (content: string, originalname = 'recipients.csv') =>
    (
      await call(controller.splitSubscribers, {
        file: { buffer: Buffer.from(content), originalname },
      })
    ).body as Split;

  // Keep this first: the module-level CSV columns, file types and upload
  // limit only take effect in the test that loads the controller.
  it('applies the CSV columns and the recipient upload rules', async () => {
    await addUser({
      email: 'expired@example.test',
      firstName: ' Padded ',
      removeProfileToken: 'fictional-token',
      removeProfileExpires: new Date(Date.now() - 86400000),
    });
    assert.equal(
      (await call(controller.list, {})).body,
      `Email Address,First Name,Last Name\nexpired@example.test,Padded,Member${seq}`,
    );
    assert.equal(
      (await split('a@example.test')).unsubscribedContent,
      'Email Address,First Name,Last Name,Reason\na@example.test,,,Email not found',
    );
    for (const [name, format] of [
      ['list.jsonl', 'jsonl'],
      ['list.NDJSON', 'ndjson'],
    ]) {
      const body = await split('{"email":" Spaced@example.test "}', name);
      assert.equal(body.outputFormat, format);
      assert.match(body.unsubscribedContent, /"spaced@example\.test"/);
    }
    for (const name of ['list.csv', 'list.jsonl', 'list.ndjson']) {
      const received = await upload('newsletterCsv', name, 'a@example.test');
      assert.equal(received.passed, true, name);
      assert.equal(received.file!.buffer.toString(), 'a@example.test');
    }
    const {
      maxUploadSize,
    }: { maxUploadSize: number } = require('../../../../config/config.mts');
    for (const [field, name, content, statusCode] of [
      ['newsletterCsv', 'list.txt', 'a@example.test', 415],
      ['other', 'list.csv', 'a@example.test', 400],
      ['newsletterCsv', 'list.csv', 'x'.repeat(maxUploadSize + 1), 413],
    ] as const) {
      const { result } = await upload(field, name, content);
      assert.equal(result.statusCode, statusCode, name);
    }
  });

  describe('criteria validation', () => {
    const hex = String(circle);
    const ids = Array.from({ length: 101 }, () =>
      String(new mongoose.Types.ObjectId()),
    );
    const hosting = (fields: Record<string, unknown>) => ({
      sources: ['hosting'],
      latitude: 1,
      longitude: 1,
      radiusKm: 10,
      ...fields,
    });

    it('rejects invalid sources, coordinates, radii and circles', async () => {
      const coordinates =
        'Enter valid latitude and longitude for hosting matching.';
      const radius = 'Enter a hosting radius between 0 and 500 kilometres.';
      const circles = 'Choose valid newsletter circles.';
      for (const [body, message] of [
        [
          { sources: ['living', 'bogus'], locationText: 'x' },
          'Choose valid newsletter location sources.',
        ],
        [
          { sources: ['from'] },
          'Enter a location for living or origin matching.',
        ],
        ...[
          ['', 10],
          [null, 10],
          [10, ''],
          [10, null],
          [-90.5, 10],
          [90.5, 10],
          [10, -180.5],
          [10, 180.5],
        ].map(([latitude, longitude]) => [
          hosting({ latitude, longitude }),
          coordinates,
        ]),
        ...['abc', 0, -1, 500.5].map(radiusKm => [
          hosting({ radiusKm }),
          radius,
        ]),
        [{ circleIds: ids }, circles],
        ...[
          { id: hex },
          { id: hex, toHexString: 'not a function' },
          { id: new Uint8Array(12), toHexString: () => hex },
          5,
          null,
        ].map(value => [{ circleIds: [value] }, circles]),
      ] as [Record<string, unknown>, string][]) {
        assert.equal(await rejection(body), message, JSON.stringify(body));
      }
    });

    it('accepts the boundaries and ObjectId-like circles with a string id and a hex method', async () => {
      await addUser({ member: [{ tribe: circle }] });
      assert.equal(await count(hosting({ radiusKm: 500 })), 0);
      assert.equal(await count({ circleIds: ids.slice(0, 100) }), 0);
      assert.equal(
        await count({ circleIds: [{ id: hex, toHexString: () => hex }] }),
        1,
      );
      for (const [latitude, longitude] of [
        [-90, 0],
        [90, 0],
        [0, -180],
        [0, 180],
      ]) {
        // The offer query passes [latitude, longitude] where MongoDB expects
        // [longitude, latitude], so ±180 longitude fails there, after
        // validation has accepted it.
        const passed = await audience(hosting({ latitude, longitude })).then(
          result => result.statusCode !== 400,
          (error: Error) => /out of bounds/.test(error.message),
        );
        assert(passed, `${latitude},${longitude}`);
      }
    });
  });

  describe('matching', () => {
    it('matches living and origin text separately, trimmed and case-insensitively', async () => {
      await addUser({
        locationLiving: 'Berlin, Germany',
        locationFrom: 'Oslo',
      });
      await addUser({ locationLiving: 'Oslo', locationFrom: 'Berlin' });
      assert.equal(
        await count({ sources: ['living'], locationText: '  berlin  ' }),
        1,
      );
      assert.equal(
        await count({ sources: ['from'], locationText: 'BERLIN' }),
        1,
      );
    });

    it('matches circle members without any location source', async () => {
      await addUser({ member: [{ tribe: circle }] });
      await addUser();
      assert.equal(await count({ circleIds: [String(circle)] }), 1);
    });

    it('matches hosts within the radius', async () => {
      const host = await addUser();
      await Offer.collection.insertOne({
        user: host._id,
        type: 'host',
        status: 'yes',
        location: [10, 1],
      });
      // About 111 km north of the offer.
      const near = { sources: ['hosting'], latitude: 11, longitude: 1 };
      assert.equal(await count({ ...near, radiusKm: 150 }), 1);
      assert.equal(await count({ ...near, radiusKm: 50 }), 0);
    });

    it('exports the audience sorted by email', async () => {
      await addUser({ email: 'zed@example.test', member: [{ tribe: circle }] });
      await addUser({ email: 'amy@example.test', member: [{ tribe: circle }] });
      const result = await audience({
        circleIds: [String(circle)],
        format: 'csv',
      });
      assert.equal(
        result.body,
        'Email Address,First Name,Last Name\namy@example.test,Fictional,Member' +
          `${seq}\nzed@example.test,Fictional,Member${seq - 1}`,
      );
    });
  });

  describe('circle member export', () => {
    it('rejects a missing query', async () => {
      for (const req of [undefined, {}, { query: undefined }] as Request[]) {
        const result = await call(controller.listCircleMembers, req);
        assert.equal(result.statusCode, 400);
      }
    });

    it('lists only members of the circle, newsletter subscribers by default', async () => {
      await addUser({ email: 'sub@example.test', member: [{ tribe: circle }] });
      await addUser({
        email: 'nonews@example.test',
        newsletter: false,
        member: [{ tribe: circle }],
      });
      await addUser({
        email: 'private@example.test',
        public: false,
        member: [{ tribe: circle }],
      });
      await addUser({ email: 'outsider@example.test' });
      const members = async (query: Request) =>
        String(
          (
            await call(controller.listCircleMembers, {
              query: { circleId: String(circle), ...query },
            })
          ).body,
        ).replace(/@example\.test,Fictional,Member\d+/g, '');
      assert.equal(
        await members({}),
        'Email Address,First Name,Last Name\nsub',
      );
      assert.equal(
        await members({ onlyNewsletterCircleMembers: 'false' }),
        'Email Address,First Name,Last Name\nsub\nnonews',
      );
    });
  });

  describe('splitting uploaded recipients', () => {
    it('answers 422 without an uploaded file', async () => {
      assert.deepEqual(await call(controller.splitSubscribers, {}), {
        statusCode: 422,
        body: { message: 'Unprocessable Entity.' },
      });
    });

    it('reads the first CSV field, skipping an email header, and normalises it', async () => {
      const body = await split(
        [
          'email@example.test',
          'alice@example.test,Alice',
          '"x,y@example.test",quoted comma',
          '"a""b@example.test",escaped quote',
          'ab@example.test',
          'myemail@example.test',
          ' <Carol@Example.test> ',
          'a<b@example.test',
          'c>d@example.test',
          'bad address@example.test',
          'trailing@example.test extra',
        ].join('\n'),
      );
      // a"b and ab are different addresses; CSV output strips the quote.
      assert.equal(body.totalEmailCount, 8);
      assert.equal(
        body.unsubscribedContent,
        [
          'Email Address,First Name,Last Name,Reason',
          ...['alice', 'xy', 'ab', 'ab', 'myemail', 'carol', 'a<b', 'c>d'].map(
            local => `${local}@example.test,,,Email not found`,
          ),
        ].join('\n'),
      );
    });

    it('writes JSON lines with blank defaults and finds stored subscribers', async () => {
      await User.collection.insertOne({
        email: 'bare@example.test',
        username: 'bare',
        public: true,
        newsletter: true,
        roles: ['user'],
      });
      await addUser({ email: 'named@example.test', newsletter: false });
      const body = await split(
        [
          '{"email":"bare@example.test"}',
          '{"email":"named@example.test"}',
          '{"email":"missing@example.test"}',
        ].join('\n'),
        'recipients.jsonl',
      );
      assert.equal(
        body.subscribedContent,
        JSON.stringify({
          displayName: '',
          email: 'bare@example.test',
          firstName: '',
          lastName: '',
          username: 'bare',
        }),
      );
      const [named, missing] = body.unsubscribedContent
        .split('\n')
        .map(line => JSON.parse(line));
      assert.equal(named.firstName, 'Fictional');
      assert.match(named.lastName, /^Member/);
      assert.equal(named.reason, 'Newsletter disabled');
      assert.deepEqual(missing, {
        displayName: '',
        email: 'missing@example.test',
        firstName: '',
        lastName: '',
        username: '',
        reason: 'Email not found',
      });
    });
  });
});

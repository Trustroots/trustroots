import type { Types } from 'mongoose';

const mongoose: typeof import('mongoose') = require('mongoose');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');

type Request = Record<string, unknown>;
type Result = { statusCode: number; body: unknown };
type Handler = (req: Request, res: unknown) => Promise<unknown>;
// Every property read evaluates a fresh copy of the module inside the running
// test, so mutants in module-level constants take effect too.
function freshModule<T>(file: string): T {
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(_target, key) {
      delete require.cache[file];
      return (require(file) as Record<string | symbol, unknown>)[key];
    },
  }) as T;
}
type Upload = (req: unknown, res: unknown, next: () => void) => void;
const controller: Record<
  'list' | 'listCircleMembers' | 'audience' | 'splitSubscribers',
  Handler
> & { uploadSubscribersCsv: Upload } = freshModule(
  require.resolve('../../server/controllers/admin.newsletter.server.controller.mts'),
);

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

  it('includes subscribers whose profile deletion request has expired', async () => {
    await addUser({
      email: 'expired@example.test',
      removeProfileToken: 'fictional-token',
      removeProfileExpires: new Date(Date.now() - 86400000),
    });
    const result = await call(controller.list, {});
    assert.match(String(result.body), /expired@example\.test/);
  });

  describe('criteria validation', () => {
    it('rejects unknown sources and requires text for origin matching', async () => {
      assert.equal(
        await rejection({ sources: ['living', 'bogus'], locationText: 'x' }),
        'Choose valid newsletter location sources.',
      );
      assert.equal(
        await rejection({ sources: ['from'] }),
        'Enter a location for living or origin matching.',
      );
    });

    it('rejects blank or out-of-range coordinates and accepts the boundaries', async () => {
      const coordinates =
        'Enter valid latitude and longitude for hosting matching.';
      for (const [latitude, longitude] of [
        ['', 10],
        [null, 10],
        [10, ''],
        [10, null],
        [-90.5, 10],
        [90.5, 10],
        [10, -180.5],
        [10, 180.5],
      ]) {
        assert.equal(
          await rejection({
            sources: ['hosting'],
            latitude,
            longitude,
            radiusKm: 10,
          }),
          coordinates,
          `${latitude},${longitude}`,
        );
      }
      for (const [latitude, longitude] of [
        [-90, 0],
        [90, 0],
        [0, -180],
        [0, 180],
      ]) {
        // The offer query passes [latitude, longitude] where MongoDB expects
        // [longitude, latitude], so ±180 longitude fails there, after
        // validation has accepted it.
        const passed = await audience({
          sources: ['hosting'],
          latitude,
          longitude,
          radiusKm: 10,
        }).then(
          result => result.statusCode !== 400,
          (error: Error) => /out of bounds/.test(error.message),
        );
        assert(passed, `${latitude},${longitude}`);
      }
    });

    it('rejects invalid radii and accepts the maximum', async () => {
      for (const radiusKm of ['abc', 0, -1, 500.5]) {
        assert.equal(
          await rejection({
            sources: ['hosting'],
            latitude: 1,
            longitude: 1,
            radiusKm,
          }),
          'Enter a hosting radius between 0 and 500 kilometres.',
          String(radiusKm),
        );
      }
      assert.equal(
        await count({
          sources: ['hosting'],
          latitude: 1,
          longitude: 1,
          radiusKm: 500,
        }),
        0,
      );
    });

    it('accepts up to 100 circles and rejects more', async () => {
      const ids = Array.from({ length: 101 }, () =>
        String(new mongoose.Types.ObjectId()),
      );
      assert.equal(await count({ circleIds: ids.slice(0, 100) }), 0);
      assert.equal(
        await rejection({ circleIds: ids }),
        'Choose valid newsletter circles.',
      );
    });

    it('accepts ObjectId-like circle values only with a string or Buffer id and a hex method', async () => {
      const hex = String(circle);
      await addUser({ member: [{ tribe: circle }] });
      assert.equal(
        await count({
          circleIds: [{ id: hex, toHexString: () => hex }],
        }),
        1,
      );
      for (const value of [
        { id: hex },
        { id: hex, toHexString: 'not a function' },
        { id: new Uint8Array(12), toHexString: () => hex },
        5,
        null,
      ]) {
        assert.equal(
          await rejection({ circleIds: [value] }),
          'Choose valid newsletter circles.',
        );
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
      for (const req of [{}, { query: undefined }]) {
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
      const subscribers = String(
        (
          await call(controller.listCircleMembers, {
            query: { circleId: String(circle) },
          })
        ).body,
      );
      assert.match(subscribers, /sub@example\.test/);
      assert.doesNotMatch(subscribers, /nonews|private|outsider/);
      const everyone = String(
        (
          await call(controller.listCircleMembers, {
            query: {
              circleId: String(circle),
              onlyNewsletterCircleMembers: 'false',
            },
          })
        ).body,
      );
      assert.match(everyone, /sub@example\.test/);
      assert.match(everyone, /nonews@example\.test/);
      assert.doesNotMatch(everyone, /private|outsider/);
    });
  });

  describe('receiving recipient uploads', () => {
    const { Readable }: typeof import('node:stream') = require('node:stream');
    type Received = {
      passed: boolean;
      result: Result;
      file?: { buffer: Buffer; originalname: string };
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

    it('accepts CSV and JSON lines files in the newsletterCsv field', async () => {
      for (const name of ['list.csv', 'list.jsonl', 'list.ndjson']) {
        const received = await upload('newsletterCsv', name, 'a@example.test');
        assert.equal(received.passed, true, name);
        assert.equal(received.file!.buffer.toString(), 'a@example.test');
      }
    });

    it('rejects other file types and fields', async () => {
      const typed = await upload('newsletterCsv', 'list.txt', 'a@example.test');
      assert.equal(typed.result.statusCode, 415);
      const field = await upload('other', 'list.csv', 'a@example.test');
      assert.equal(field.result.statusCode, 400);
      assert.deepEqual(field.result.body, {
        message: 'Missing "newsletterCsv" field from the API call.',
      });
    });

    it('limits the upload size', async () => {
      const config: {
        maxUploadSize: number;
      } = require('../../../../config/config.mts');
      const received = await upload(
        'newsletterCsv',
        'list.csv',
        'x'.repeat(config.maxUploadSize + 1),
      );
      assert.equal(received.result.statusCode, 413);
    });

    it('reads JSON lines from .ndjson uploads', async () => {
      const result = await call(controller.splitSubscribers, {
        file: {
          buffer: Buffer.from('{"email":"a@example.test"}'),
          originalname: 'list.NDJSON',
        },
      });
      assert.equal(
        (result.body as { outputFormat: string }).outputFormat,
        'ndjson',
      );
    });
  });

  describe('splitting uploaded recipients', () => {
    const split = (content: string, originalname = 'recipients.csv') =>
      call(controller.splitSubscribers, {
        file: { buffer: Buffer.from(content), originalname },
      });
    type Split = {
      totalEmailCount: number;
      subscribedContent: string;
      unsubscribedContent: string;
    };

    it('reads the first CSV field, honouring quotes, escaped quotes and later columns', async () => {
      const result = await split(
        [
          'alice@example.test,Alice',
          '"x,y@example.test",quoted comma',
          '"a""b@example.test",escaped quote',
          'ab@example.test',
          'myemail@example.test',
        ].join('\n'),
      );
      const body = result.body as Split;
      // a"b and ab are different addresses; CSV output strips the quote.
      assert.equal(body.totalEmailCount, 5);
      assert.equal(
        body.unsubscribedContent,
        [
          'Email Address,First Name,Last Name,Reason',
          'alice@example.test,,,Email not found',
          'xy@example.test,,,Email not found',
          'ab@example.test,,,Email not found',
          'ab@example.test,,,Email not found',
          'myemail@example.test,,,Email not found',
        ].join('\n'),
      );
    });

    it('skips a first line that mentions email as a header', async () => {
      const body = (await split('email@example.test\nbob@example.test'))
        .body as Split;
      assert.equal(body.totalEmailCount, 1);
      assert.match(body.unsubscribedContent, /bob@example\.test/);
    });

    it('normalises angle brackets, case and spacing but keeps inner brackets', async () => {
      const body = (
        await split(
          [
            ' <Alice@Example.test> ',
            'a<b@example.test',
            'c>d@example.test',
            'bad address@example.test',
            'trailing@example.test extra',
          ].join('\n'),
        )
      ).body as Split;
      assert.equal(
        body.unsubscribedContent,
        [
          'Email Address,First Name,Last Name,Reason',
          'alice@example.test,,,Email not found',
          'a<b@example.test,,,Email not found',
          'c>d@example.test,,,Email not found',
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
      const body = (
        await split(
          [
            '{"email":"bare@example.test"}',
            '{"email":"named@example.test"}',
            '{"email":"missing@example.test"}',
          ].join('\n'),
          'recipients.jsonl',
        )
      ).body as Split;
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

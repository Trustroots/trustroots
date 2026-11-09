import type { Types } from 'mongoose';
const { Readable } = require('node:stream') as typeof import('node:stream');

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const {
  parseSupportMailSource,
  pollSupportMailbox,
}: typeof import('../../server/jobs/poll-support-mailbox.server.job.mts') = require('../../server/jobs/poll-support-mailbox.server.job.mts');

interface Doc {
  _id: Types.ObjectId;
  [key: string]: unknown;
}

const SupportRequest = mongoose.model<Doc>('SupportRequest');
const SupportMessage = mongoose.model<Doc>('SupportMessage');
const Cursor = mongoose.model<Doc>('SupportMailboxCursor');
let ImapFlowClass: typeof import('imapflow').ImapFlow;

const ORIGINAL_INBOX = {
  ...config.supportInbox,
  imap: { ...config.supportInbox.imap },
};
const CUTOVER_AT = new Date('2025-02-01T00:00:00.000Z');
const FRESH = new Date('2025-03-01T00:00:00.000Z');
const OLD = new Date('2025-01-01T00:00:00.000Z');
const ITEM_DATE = '2025-02-15T00:00:00.000Z';
const COMPLETED = 'Support mailbox poll completed #hK4tPq';

function mimeMail(
  overrides: {
    from?: string;
    body?: string;
    headers?: string[];
    subject?: string | null;
    messageId?: string | null;
  } = {},
) {
  return [
    `From: ${overrides.from ?? 'Visitor <visitor@example.org>'}`,
    'To: Trustroots Support <support@trustroots.org>',
    ...(overrides.subject === null
      ? []
      : [`Subject: ${overrides.subject ?? 'A fictional support message'}`]),
    ...(overrides.messageId === null
      ? []
      : [`Message-ID: ${overrides.messageId ?? '<incoming-1@example.org>'}`]),
    ...(overrides.headers ?? []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    overrides.body ?? 'Hello, this is a fictional support message.',
  ].join('\r\n');
}

const REPORT_HEAD = ['From: Visitor <visitor@example.org>', 'Subject: Report'];
const DSN_TYPE = 'multipart/report; report-type=delivery-status';
const TEXT_PART = 'Content-Type: text/plain\r\n\r\nA fictional report.';
const statusPart = (body: string) =>
  `Content-Type: message/delivery-status\r\n\r\n${body}`;

/** A multipart message with boundary "b" built from whole parts. */
function multipart(contentType: string, parts: string[], head = REPORT_HEAD) {
  return [
    ...head,
    `Content-Type: ${contentType}; boundary="b"`,
    '',
    ...parts.flatMap(part => ['--b', part]),
    '--b--',
  ].join('\r\n');
}

async function parse(source: string | string[]) {
  return parseSupportMailSource(
    Readable.from(Array.isArray(source) ? source : [source]),
    1000,
  );
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    from: [{ address: 'visitor@example.org', name: 'Visitor' }],
    subject: 'A fictional support message',
    messageId: '<incoming-1@example.org>',
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    uid: 11,
    size: 200,
    envelope: envelope(),
    internalDate: new Date(ITEM_DATE),
    bodyStructure: { type: 'text/plain', childNodes: [] },
    headers: Buffer.from(''),
    ...overrides,
  };
}

/** A fetched item with this envelope Message-ID. */
function itemWithId(
  messageId: string,
  overrides: Record<string, unknown> = {},
) {
  return item({ ...overrides, envelope: envelope({ messageId }) });
}

/** Matching fetched items (from UID 11) and sources for these messages. */
function mails(
  ...messages: Array<
    [messageId: string, headers?: string[], envelopeExtra?: object]
  >
) {
  return {
    fetched: messages.map(([messageId, , envelopeExtra], index) =>
      item({
        uid: 11 + index,
        envelope: envelope({ messageId, ...envelopeExtra }),
      }),
    ),
    sources: messages.map(([messageId, headers]) =>
      mimeMail({ messageId, headers }),
    ),
  };
}

const IN_REPLY_TO_ROOT = ['In-Reply-To: <root@example.org>'];
const seedThread = (extra: Record<string, unknown> = {}) =>
  seedRequest({ initialMessageId: '<root@example.org>', ...extra });

/** A fetched item whose size exceeds the 1000 byte limit: no download. */
function oversizedItem(overrides: Record<string, unknown> = {}) {
  return item({ size: 5000, ...overrides });
}

interface MockOptions {
  uidValidity?: string;
  uidNext?: number;
  fetched?: object[];
  fetchGenerator?: () => AsyncGenerator<object>;
  sources?: string[];
  fromAddress?: string;
  maxStoredBodyBytes?: number;
  imap?: Record<string, unknown>;
}

function mockMailbox(options: MockOptions = {}) {
  config.supportInbox = {
    ...ORIGINAL_INBOX,
    enabled: true,
    imap: {
      ...ORIGINAL_INBOX.imap,
      enabled: true,
      host: 'imap.example.org',
      user: 'support@example.org',
      password: 'fictional-secret',
      maxMessageBytes: 1000,
      ...(options.maxStoredBodyBytes !== undefined && {
        maxStoredBodyBytes: options.maxStoredBodyBytes,
      }),
      ...options.imap,
    },
    ...(options.fromAddress !== undefined && {
      fromAddress: options.fromAddress,
    }),
  };
  const release = sinon.spy();
  const connect = sinon.stub(ImapFlowClass.prototype, 'connect').resolves();
  const getMailboxLock = sinon
    .stub(ImapFlowClass.prototype, 'getMailboxLock')
    .callsFake(function (this: InstanceType<typeof ImapFlowClass>) {
      Object.assign(this, {
        mailbox: {
          uidValidity: options.uidValidity ?? '42',
          uidNext: options.uidNext ?? 12,
        },
      });
      return Promise.resolve({ path: 'INBOX', release });
    });
  const logout = sinon.stub(ImapFlowClass.prototype, 'logout').resolves();
  const close = sinon
    .stub(ImapFlowClass.prototype, 'close')
    .callsFake(() => undefined);
  const fetch = sinon.stub(ImapFlowClass.prototype, 'fetch').callsFake((() =>
    options.fetchGenerator
      ? options.fetchGenerator()
      : (async function* () {
          for (const value of options.fetched ?? []) yield value;
        })()) as never);
  let sourceIndex = 0;
  const download = sinon
    .stub(ImapFlowClass.prototype, 'download')
    .callsFake((async () => ({
      content: Readable.from([options.sources?.[sourceIndex++] ?? mimeMail()]),
    })) as never);
  return {
    release,
    connect,
    logout,
    close,
    fetch,
    download,
    client: () =>
      getMailboxLock.thisValues[0] as InstanceType<typeof ImapFlowClass>,
  };
}

function stubLog() {
  return sinon.stub(winston, 'log') as unknown as sinon.SinonStub<
    unknown[],
    unknown
  >;
}

function loggedCompleted(
  log: ReturnType<typeof stubLog>,
  details: unknown = sinon.match.any,
) {
  return log.calledWith('info', COMPLETED, details);
}

async function poll(touch: () => Promise<void> = async () => undefined) {
  await new Promise<void>((resolve, reject) => {
    pollSupportMailbox({ attrs: {}, touch } as never, error =>
      error ? reject(error) : resolve(),
    );
  });
}

function pollFailsWith(error: Error, touch?: () => Promise<void>) {
  return assert.rejects(poll(touch), caught => caught === error);
}

async function seedCursor(extra: Record<string, unknown> = {}) {
  await Cursor.create({
    _id: 'support-inbox',
    uidValidity: '42',
    lastUid: 10,
    cutoverAt: CUTOVER_AT,
    ...extra,
  });
}

/** Seeds the default cursor, mocks the mailbox and runs one poll. */
async function pollWith(options: MockOptions = {}) {
  await seedCursor();
  const mock = mockMailbox(options);
  await poll();
  return mock;
}

async function seedRequest(extra: Record<string, unknown> = {}) {
  return (await SupportRequest.create({
    category: 'other',
    email: 'visitor@example.org',
    message: 'A fictional original request.',
    status: 'open',
    statusRevision: 0,
    sent: new Date('2024-01-01T00:00:00.000Z'),
    ...extra,
  } as never)) as unknown as Doc;
}

function outbound(
  request: Doc,
  messageId: string,
  extra: Record<string, unknown> = {},
) {
  return SupportMessage.create({
    request: request._id,
    direction: 'outbound',
    body: 'A fictional reply.',
    messageId,
    deliveryState: 'accepted',
    ...extra,
  } as never);
}

const requestFor = (initialMessageId: string) =>
  SupportRequest.findOne({ initialMessageId }).lean();
const firstRequest = () => SupportRequest.findOne().lean();
const messageCount = (filter: Record<string, unknown> = {}) =>
  SupportMessage.countDocuments(filter);
const cursorDoc = (id = 'support-inbox') => Cursor.findById(id).lean();
const iso = (date: unknown) => (date as Date).toISOString();

describe('support mailbox job mutation hardening', () => {
  before(async () => {
    ImapFlowClass = (await import('imapflow')).ImapFlow;
  });

  beforeEach(() => {
    config.supportInbox = {
      ...ORIGINAL_INBOX,
      enabled: false,
      imap: { ...ORIGINAL_INBOX.imap },
    };
  });

  afterEach(async () => {
    sinon.restore();
    config.supportInbox = {
      ...ORIGINAL_INBOX,
      imap: { ...ORIGINAL_INBOX.imap },
    };
    await utils.clearDatabase();
  });

  describe('parsing a downloaded message', () => {
    it('detects automated mail from Auto-Submitted, delivery-status reports and daemon senders', async () => {
      const cases: Array<[string, boolean]> = [
        // Only an Auto-Submitted value other than "no" counts.
        [mimeMail({ headers: ['Auto-Submitted: no'] }), false],
        [mimeMail({ headers: ['Auto-Submitted: No'] }), false],
        [mimeMail({ headers: ['Auto-Submitted: auto-replied'] }), true],
        // Only a delivery-status multipart/report counts.
        [multipart(DSN_TYPE, [TEXT_PART]), true],
        [
          multipart('multipart/report; report-type=disposition-notification', [
            TEXT_PART,
          ]),
          false,
        ],
        [multipart('multipart/report', [TEXT_PART]), false],
        [
          multipart('multipart/mixed; report-type=delivery-status', [
            TEXT_PART,
          ]),
          false,
        ],
        // Only postmaster and mailer-daemon senders count.
        [mimeMail({ from: 'postmaster@example.org' }), true],
        [mimeMail({ from: 'MAILER-DAEMON@example.org' }), true],
        [mimeMail({ from: 'notpostmaster@example.org' }), false],
      ];
      for (const [source, automated] of cases) {
        assert.equal((await parse(source)).automated, automated, source);
      }
    });

    it('takes the sender from the first From address and ignores a From without one', async () => {
      assert.equal(
        (await parse(mimeMail({ from: 'Other <other@example.org>' }))).sender,
        'other@example.org',
      );
      const group = await parse(mimeMail({ from: 'undisclosed-recipients:;' }));
      assert.equal(group.sender, undefined);
      assert.equal(group.automated, false);
    });

    it('keeps only well-formed References ids', async () => {
      const parsed = await parse(
        mimeMail({
          headers: ['References: <ok@example.org> bogus <alsobad>'],
        }),
      );
      assert.deepEqual(parsed.references, ['<ok@example.org>']);
    });

    it('reads the reported Message-ID only from a whole Original-Message-ID line', async () => {
      const dsn = (status: string) =>
        parse(multipart(DSN_TYPE, [TEXT_PART, statusPart(status)]));
      for (const status of [
        'Action: failed\r\nX-Original-Message-ID: <prefixed@example.org>',
        'Action: failed\r\nOriginal-Message-ID: <trailing@example.org> junk',
      ]) {
        assert.equal((await dsn(status)).reportedMessageId, undefined);
      }
      const spaced = await dsn(
        'Original-Message-ID:   <spaced@example.org>   \r\nAction: failed\r\nX-End: 1',
      );
      assert.equal(spaced.reportedMessageId, '<spaced@example.org>');
      assert.equal(spaced.deliveryStatus, 'failed');
    });

    it('stops collecting a delivery status after 64 KiB and ignores other attachments', async () => {
      const padding = `${'X-Pad: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\r\n'.repeat(Math.ceil(72_000 / 72))}`;
      // Small input chunks reach the collector as several output chunks, one
      // of which crosses the 64 KiB cap.
      const source = `${multipart(DSN_TYPE, [TEXT_PART, statusPart(`${padding}Action: failed`)])}\r\n`;
      const parsed = await parse(source.match(/[\s\S]{1,4096}/g) as string[]);
      assert.equal(parsed.deliveryStatus, undefined);

      const other = await parse(
        multipart(
          'multipart/mixed',
          [
            'Content-Type: text/plain\r\n\r\nA fictional note.',
            [
              'Content-Type: text/plain; name="notes.txt"',
              'Content-Disposition: attachment; filename="notes.txt"',
              '',
              'Action: failed',
              'Original-Message-ID: <not-a-report@example.org>',
            ].join('\r\n'),
          ],
          [REPORT_HEAD[0], 'Subject: Not a report'],
        ),
      );
      assert.equal(other.deliveryStatus, undefined);
      assert.equal(other.reportedMessageId, undefined);
    });

    it('keeps attachment metadata within its limits and leaves the body empty without a text part', async () => {
      const parsed = await parse(
        multipart(
          'multipart/mixed',
          [
            [
              `Content-Type: application/x-${'t'.repeat(200)}; name="${'f'.repeat(300)}.bin"`,
              `Content-Disposition: attachment; filename="${'f'.repeat(300)}.bin"`,
              'Content-Transfer-Encoding: base64',
              '',
              'cHJpdmF0ZS1jb250ZW50',
            ].join('\r\n'),
          ],
          [REPORT_HEAD[0], 'Subject: Only an attachment'],
        ),
      );
      assert.equal(parsed.body, '');
      assert.equal(parsed.attachments.length, 1);
      assert.equal(parsed.attachments[0].filename?.length, 255);
      assert.equal(parsed.attachments[0].contentType?.length, 120);
      assert.equal(parsed.attachments[0].size, 15);
    });
  });

  describe('configuration and connection handling', () => {
    it('does not connect unless both the support inbox and the mailbox are enabled', async () => {
      const mock = mockMailbox();
      const imap = config.supportInbox.imap;
      for (const [enabled, imapEnabled] of [
        [true, false],
        [false, true],
      ]) {
        config.supportInbox = {
          ...config.supportInbox,
          enabled,
          imap: { ...imap, enabled: imapEnabled },
        };
        await poll();
      }
      assert.equal(mock.connect.called, false);
    });

    for (const field of ['host', 'user', 'password']) {
      it(`rejects a mailbox configuration with only the ${field} missing`, async () => {
        const mock = mockMailbox({ imap: { [field]: '' } });
        await assert.rejects(poll(), /configuration is incomplete/);
        assert.equal(mock.connect.called, false);
      });
    }

    it('closes the connection when the client emits an error and fails with that error', async () => {
      await seedCursor();
      const error = new Error('synthetic IMAP failure');
      const mock = mockMailbox({ fetched: [item()] });
      mock.download.callsFake((async () => {
        void mock.client().emit('error', error);
        return { content: Readable.from([mimeMail()]) };
      }) as never);
      await pollFailsWith(error);
      assert.equal(mock.close.callCount, 1);
      assert.equal(await SupportRequest.countDocuments(), 0);
    });

    it('releases the mailbox lock before logging out', async () => {
      const first = mockMailbox();
      await poll();
      assert.equal(first.release.called, true);
      assert.ok(first.release.firstCall.calledBefore(first.logout.firstCall));
      assert.equal(await Cursor.countDocuments(), 1);

      sinon.restore();
      const second = mockMailbox();
      await poll();
      assert.ok(second.release.firstCall.calledBefore(second.logout.firstCall));
    });

    it('fails the poll when the client reports an error while logging out', async () => {
      await seedCursor();
      const error = new Error('synthetic logout failure');
      const mock = mockMailbox();
      mock.logout.callsFake((async () => {
        void mock.client().emit('error', error);
      }) as never);
      await pollFailsWith(error);
    });

    it('stops its heartbeat and fails the poll when the heartbeat cannot renew the lock', async () => {
      await seedCursor();
      const realSetInterval = global.setInterval;
      const realClearInterval = global.clearInterval;
      const handle = { unref() {} } as unknown as NodeJS.Timeout;
      let tick: (() => void) | undefined;
      sinon.stub(global, 'setInterval').callsFake(((
        callback: () => void,
        delay?: number,
      ) => {
        if (delay !== 60_000) return realSetInterval(callback, delay);
        tick = callback;
        return handle;
      }) as never);
      const cleared: unknown[] = [];
      sinon.stub(global, 'clearInterval').callsFake(((timer: never) => {
        if (timer === handle) cleared.push(timer);
        else realClearInterval(timer);
      }) as never);

      const mock = mockMailbox({ fetched: [item()] });
      const error = new Error('synthetic lock renewal failure');
      let renewing = false;
      mock.download.callsFake((async () => {
        renewing = true;
        tick?.();
        await new Promise(resolve => setImmediate(resolve));
        renewing = false;
        return { content: Readable.from([mimeMail()]) };
      }) as never);
      await pollFailsWith(error, async () => {
        if (renewing) throw error;
      });
      assert.equal(await SupportRequest.countDocuments(), 0);
      assert.deepEqual(cleared, [handle]);
    });

    it('connects over verified TLS without client logging and requests the next UID range with the fields it reads', async () => {
      const mock = await pollWith({ fetched: [item()] });
      const { host, port, user, password } = config.supportInbox.imap;
      assert.deepEqual(mock.client().options, {
        host,
        port,
        secure: true,
        tls: { rejectUnauthorized: true },
        auth: { user, pass: password },
        logger: false,
      });
      assert.deepEqual(mock.fetch.firstCall.args, [
        '11:*',
        {
          uid: true,
          size: true,
          envelope: true,
          internalDate: true,
          bodyStructure: true,
          headers: [
            'AUTO-SUBMITTED',
            'CONTENT-TYPE',
            'REFERENCES',
            'IN-REPLY-TO',
          ],
        },
        { uid: true },
      ]);
      assert.deepEqual(mock.download.firstCall.args, [
        11,
        undefined,
        { uid: true, maxBytes: 1000 },
      ]);
    });

    it('downloads a message whose size is exactly the limit instead of treating it as oversized', async () => {
      const mock = await pollWith({ fetched: [item({ size: 1000 })] });
      assert.equal(mock.download.callCount, 1);
      const request = await firstRequest();
      assert.equal(request?.oversized, false);
      assert.equal(
        request?.message,
        'Hello, this is a fictional support message.',
      );
    });

    it('stops reading the fetch once the connection has failed', async () => {
      await seedCursor();
      const error = new Error('synthetic fetch failure');
      let resumed = false;
      const mock: ReturnType<typeof mockMailbox> = mockMailbox({
        async *fetchGenerator() {
          mock.client().emit('error', error);
          yield item();
          resumed = true;
          yield item({ uid: 12 });
        },
      });
      await pollFailsWith(error);
      assert.equal(resumed, false);
      assert.equal(await SupportRequest.countDocuments(), 0);
    });

    it('processes nothing when the connection fails after the last message was fetched', async () => {
      await seedCursor();
      const error = new Error('synthetic late failure');
      const mock: ReturnType<typeof mockMailbox> = mockMailbox({
        async *fetchGenerator() {
          yield item();
          mock.client().emit('error', error);
        },
      });
      await pollFailsWith(error);
      assert.equal(mock.download.called, false);
      assert.equal(await SupportRequest.countDocuments(), 0);
      assert.equal((await cursorDoc())?.lastUid, 10);
    });
  });

  describe('rescanning after a UIDVALIDITY change', () => {
    // UIDNEXT 6 puts the rescan boundary at UID 5.
    const rescanItem = (uid: number, internalDate: Date | undefined) =>
      itemWithId(`<rescan-${uid}@example.org>`, { uid, internalDate });
    const seedOtherCursor = () =>
      Cursor.create({
        _id: 'other-cursor',
        uidValidity: '42',
        lastUid: 1,
        cutoverAt: CUTOVER_AT,
      });
    const importedIds = async () =>
      (await SupportRequest.find().lean()).map(r => r.initialMessageId).sort();

    async function rescan(items: Array<[number, Date | undefined]>) {
      // Inserted first, so a cursor update that lost its filter would hit it.
      await seedOtherCursor();
      await seedCursor({ updatedAt: OLD });
      const mock = mockMailbox({
        uidValidity: '99',
        uidNext: 6,
        fetched: items.map(([uid, date]) => rescanItem(uid, date)),
      });
      mock.download.callsFake((async (uid: number) => ({
        content: Readable.from([
          mimeMail({ messageId: `<rescan-${uid}@example.org>` }),
        ]),
      })) as never);
      await poll();
      const cursor = await cursorDoc();
      const other = await cursorDoc('other-cursor');
      assert.equal(other?.uidValidity, '42');
      assert.equal(other?.lastUid, 1);
      assert.equal(other?.rescanThroughUid, undefined);
      assert.ok(cursor?.updatedAt instanceof Date);
      assert.ok(cursor.updatedAt.getTime() > FRESH.getTime());
      assert.equal(cursor?.uidValidity, '99');
      return cursor;
    }

    const scenarios: Array<{
      name: string;
      items: Array<[number, Date | undefined]>;
      lastUid: number;
      rescanThroughUid: number | undefined;
      imported: string[];
    }> = [
      {
        name: 'skips an old message below the boundary and keeps the boundary',
        items: [[2, OLD]],
        lastUid: 2,
        rescanThroughUid: 5,
        imported: [],
      },
      {
        name: 'skips an old message at the boundary and clears it',
        items: [[5, OLD]],
        lastUid: 5,
        rescanThroughUid: undefined,
        imported: [],
      },
      {
        name: 'imports a fresh message below the boundary and keeps the boundary',
        items: [[3, FRESH]],
        lastUid: 3,
        rescanThroughUid: 5,
        imported: ['<rescan-3@example.org>'],
      },
      {
        name: 'imports a fresh message at the boundary and clears it',
        items: [[5, FRESH]],
        lastUid: 5,
        rescanThroughUid: undefined,
        imported: ['<rescan-5@example.org>'],
      },
      {
        name: 'imports an old message above the boundary and clears it',
        items: [[7, OLD]],
        lastUid: 7,
        rescanThroughUid: undefined,
        imported: ['<rescan-7@example.org>'],
      },
      {
        name: 'skips a message without a date, imports one dated exactly at the cutover and one dated after it',
        items: [
          [1, undefined],
          [2, CUTOVER_AT],
          [3, FRESH],
        ],
        lastUid: 3,
        rescanThroughUid: 5,
        imported: ['<rescan-2@example.org>', '<rescan-3@example.org>'],
      },
      {
        name: 'keeps skipping old messages after importing a fresh one below the boundary',
        items: [
          [3, FRESH],
          [4, OLD],
        ],
        lastUid: 4,
        rescanThroughUid: 5,
        imported: ['<rescan-3@example.org>'],
      },
    ];
    for (const scenario of scenarios) {
      it(scenario.name, async () => {
        const cursor = await rescan(scenario.items);
        assert.equal(cursor?.lastUid, scenario.lastUid);
        assert.equal(cursor?.rescanThroughUid, scenario.rescanThroughUid);
        assert.deepEqual(await importedIds(), [...scenario.imported].sort());
      });
    }

    it('stops skipping once the boundary has been reached, even for a lower UID that follows', async () => {
      await rescan([
        [5, OLD],
        [4, OLD],
      ]);
      assert.deepEqual(await importedIds(), ['<rescan-4@example.org>']);

      await utils.clearDatabase();
      sinon.restore();
      await rescan([
        [5, FRESH],
        [4, OLD],
      ]);
      assert.deepEqual(await importedIds(), [
        '<rescan-4@example.org>',
        '<rescan-5@example.org>',
      ]);
    });

    it('records a skipped message in the cursor without a UIDVALIDITY change', async () => {
      await seedOtherCursor();
      await seedCursor({ lastUid: 0, rescanThroughUid: 5, updatedAt: OLD });
      mockMailbox({ fetched: [rescanItem(2, OLD)] });
      await poll();
      const cursor = await cursorDoc();
      assert.equal(cursor?.lastUid, 2);
      assert.equal(cursor?.rescanThroughUid, 5);
      assert.ok((cursor?.updatedAt as Date).getTime() > FRESH.getTime());
      assert.equal((await cursorDoc('other-cursor'))?.lastUid, 1);
    });

    it('imports an old message when no rescan is pending and stamps the cursor', async () => {
      await seedCursor({ updatedAt: OLD });
      mockMailbox({ fetched: [item({ internalDate: OLD })] });
      await poll();
      assert.equal(await SupportRequest.countDocuments(), 1);
      const cursor = await cursorDoc();
      assert.equal(cursor?.lastUid, 11);
      assert.ok((cursor?.updatedAt as Date).getTime() > FRESH.getTime());
    });

    it('counts rescanned and imported messages as processed', async () => {
      const log = stubLog();
      await rescan([
        [1, OLD],
        [3, FRESH],
      ]);
      assert.ok(loggedCompleted(log, sinon.match({ processed: 2 })));
    });
  });

  describe('messages above the size limit', () => {
    it('normalises Message-IDs from the envelope strictly', async () => {
      await pollWith({
        fetched: [
          '  <spaced@example.org>  ',
          'x<inner@example.org',
          'inner@example.org>y',
        ].map((messageId, index) =>
          oversizedItem({ uid: 11 + index, envelope: envelope({ messageId }) }),
        ),
      });
      const requests = await SupportRequest.find().sort({ _id: 1 }).lean();
      assert.deepEqual(
        requests.map(request => request.initialMessageId),
        ['<spaced@example.org>', undefined, undefined],
      );
      assert.deepEqual(
        requests.map(request => request.initialInboundKey),
        ['<spaced@example.org>', 'imap:42:12', 'imap:42:13'],
      );
    });

    it('records attachment metadata for attachment and named parts only, within limits', async () => {
      await pollWith({
        fetched: [
          oversizedItem({
            bodyStructure: {
              type: 'multipart/mixed',
              childNodes: [
                { type: 'text/plain', size: 10 },
                {
                  type: 'multipart/related',
                  childNodes: [
                    {
                      type: 'application/pdf',
                      size: 5,
                      disposition: 'ATTACHMENT',
                      dispositionParameters: {},
                    },
                    {
                      type: 'application/zip',
                      size: 6,
                      disposition: 'attachment',
                    },
                  ],
                },
                {
                  type: 'image/png',
                  size: 7,
                  disposition: 'inline',
                  dispositionParameters: { filename: `${'n'.repeat(300)}.png` },
                },
                {
                  type: `application/x-${'t'.repeat(200)}`,
                  size: 9,
                  disposition: 'attachment',
                  dispositionParameters: { filename: 'short.bin' },
                },
              ],
            },
          }),
        ],
      });
      const request = await firstRequest();
      const attachments = (request?.initialAttachments as Doc[]).map(
        ({ filename, contentType, size }) => ({ filename, contentType, size }),
      );
      assert.deepEqual(attachments, [
        { filename: undefined, contentType: 'application/pdf', size: 5 },
        { filename: undefined, contentType: 'application/zip', size: 6 },
        { filename: 'n'.repeat(255), contentType: 'image/png', size: 7 },
        {
          filename: 'short.bin',
          contentType: `application/x-${'t'.repeat(106)}`,
          size: 9,
        },
      ]);
    });

    it('has no attachments and no references when the server sent neither structure nor headers', async () => {
      await pollWith({
        fetched: [
          oversizedItem({ bodyStructure: undefined, headers: Buffer.from('') }),
        ],
      });
      const request = await firstRequest();
      assert.deepEqual(request?.initialAttachments, []);
      assert.deepEqual(request?.initialReferences, []);
      assert.equal(request?.oversized, true);
      assert.equal(request?.truncated, true);
    });

    it('keeps only valid References ids from the headers, across folded lines', async () => {
      await pollWith({
        fetched: [
          oversizedItem({
            headers: Buffer.from(
              'Subject: x\r\nreferences: <invalid> <valid@example.org>\r\n <folded@example.org>\r\n',
            ),
          }),
        ],
      });
      assert.deepEqual((await firstRequest())?.initialReferences, [
        '<valid@example.org>',
        '<folded@example.org>',
      ]);
    });

    const subjects: Array<[string, string, string]> = [
      [
        'takes the subject from the envelope on one line',
        'First line\r\n\r\nSecond line',
        'First line Second line',
      ],
      [
        'cuts a very long subject to 998 characters',
        'S'.repeat(1200),
        'S'.repeat(998),
      ],
    ];
    for (const [name, subject, expected] of subjects) {
      it(name, async () => {
        await pollWith({
          fetched: [oversizedItem({ envelope: envelope({ subject }) })],
        });
        assert.equal((await firstRequest())?.subject, expected);
      });
    }

    describe('automated mail', () => {
      const automated: Array<[string, string, Record<string, unknown>?]> = [
        ['an Auto-Submitted header', 'Auto-Submitted: auto-generated'],
        [
          'an Auto-Submitted header on a later line',
          'Subject: x\r\nauto-submitted: auto-replied',
        ],
        [
          'an Auto-Submitted header without a space',
          'Auto-Submitted:auto-generated',
        ],
        ['an Auto-Submitted value starting with "no"', 'Auto-Submitted:notice'],
        [
          'a delivery-status report type without spaces',
          'Content-Type: multipart/report;report-type=delivery-status',
        ],
        [
          'a delivery-status report type with spaces around the separators',
          'Content-Type: multipart/report ; report-type = delivery-status',
        ],
        [
          'a mailer-daemon sender',
          '',
          { from: [{ address: 'mailer-daemon@example.org' }] },
        ],
      ];
      for (const [label, headers, envelopeOverrides] of automated) {
        it(`skips a message with ${label}`, async () => {
          const mock = await pollWith({
            fetched: [
              oversizedItem({
                headers: Buffer.from(`${headers}\r\n`),
                envelope: envelope(envelopeOverrides),
              }),
            ],
          });
          assert.equal(await SupportRequest.countDocuments(), 0);
          assert.equal(mock.download.called, false);
          assert.equal((await cursorDoc())?.lastUid, 11);
        });
      }

      const manual: Array<[string, string | undefined, string?]> = [
        ['no headers', undefined],
        [
          'an Auto-Submitted value of "no" without a space',
          'Auto-Submitted:no',
        ],
        [
          'an Auto-Submitted value of "no" with trailing spaces',
          'Auto-Submitted:no   ',
        ],
        [
          'an Auto-Submitted value of "no" then a newline',
          'Auto-Submitted:no\r\n',
        ],
        ['an empty Auto-Submitted header', 'Auto-Submitted:'],
        [
          'a prefixed X-Auto-Submitted header',
          'X-Auto-Submitted: auto-generated\r\n',
        ],
        [
          'a multipart/report that is not a delivery status',
          'Content-Type: multipart/report; report-type=disposition-notification\r\n',
        ],
        [
          'a sender that merely ends in postmaster',
          '',
          'notpostmaster@example.org',
        ],
      ];
      for (const [label, headers, from] of manual) {
        it(`imports a message with ${label}`, async () => {
          await pollWith({
            fetched: [
              oversizedItem({
                headers:
                  headers === undefined ? undefined : Buffer.from(headers),
                envelope: envelope(from ? { from: [{ address: from }] } : {}),
              }),
            ],
          });
          assert.equal(await SupportRequest.countDocuments(), 1);
        });
      }
    });

    describe('thread headers', () => {
      async function replies(items: Array<Record<string, unknown>>) {
        const thread = await seedThread();
        await pollWith({ fetched: items });
        return {
          attached: (await SupportMessage.find({ request: thread._id }).lean())
            .map(message => message.inboundKey)
            .sort(),
          created: (
            await SupportRequest.find({ _id: { $ne: thread._id } }).lean()
          )
            .map(request => request.initialInboundKey)
            .sort(),
        };
      }
      const reply = (uid: number, headers?: string, inReplyTo?: string) =>
        oversizedItem({
          uid,
          headers: headers === undefined ? undefined : Buffer.from(headers),
          envelope: envelope({
            messageId: `<thread-${uid}@example.org>`,
            ...(inReplyTo && { inReplyTo }),
          }),
        });

      it('finds the In-Reply-To in the headers, the envelope, or neither', async () => {
        const result = await replies([
          reply(11, undefined, '<root@example.org>'),
          reply(12, 'Subject: x\r\n', '<root@example.org>'),
          reply(13, 'Subject: x\r\nin-reply-to: <root@example.org>\r\n'),
          reply(
            14,
            'In-Reply-To: <root@example.org>\r\n',
            '<other@example.org>',
          ),
          reply(15, 'Subject: x\r\n'),
        ]);
        assert.deepEqual(result.attached, [
          '<thread-11@example.org>',
          '<thread-12@example.org>',
          '<thread-13@example.org>',
          '<thread-14@example.org>',
        ]);
        assert.deepEqual(result.created, ['<thread-15@example.org>']);
      });

      it('does not join a folded header value into a new Message-ID', async () => {
        const result = await replies([
          reply(11, 'In-Reply-To: <root@exam\r\n ple.org>\r\n'),
        ]);
        assert.deepEqual(result.attached, []);
        assert.deepEqual(result.created, ['<thread-11@example.org>']);
      });

      it('falls back to the envelope when the In-Reply-To header is empty', async () => {
        const result = await replies([
          reply(11, 'In-Reply-To: \r\n\r\n', '<root@example.org>'),
        ]);
        assert.deepEqual(result.attached, ['<thread-11@example.org>']);
      });
    });
  });

  describe('stored text', () => {
    const NOTE = '\n[Message text truncated after 0 MiB]';
    const NOTE_BYTES = Buffer.byteLength(NOTE);

    const cases: Array<{
      name: string;
      body: string;
      limit?: number;
      message: string;
      truncated?: boolean;
      oversized?: boolean;
    }> = [
      {
        name: 'trims the text',
        body: '  \r\n\r\n   padded text  \r\n',
        message: 'padded text',
      },
      {
        name: 'replaces a blank body with a placeholder',
        body: '   \r\n  ',
        message: '[Message body unavailable]',
      },
      {
        name: 'stores a message that is exactly at the byte limit untruncated',
        body: 'B'.repeat(50),
        limit: 50,
        message: 'B'.repeat(50),
        truncated: false,
        oversized: false,
      },
      {
        name: 'cuts the text to the byte limit, leaving room for the truncation note',
        body: 'B'.repeat(200),
        limit: NOTE_BYTES + 20,
        message: `${'B'.repeat(20)}${NOTE}`,
        truncated: true,
      },
      {
        name: 'never splits a surrogate pair when cutting',
        body: `${'A'.repeat(40)}😀${'more '.repeat(30)}`,
        limit: NOTE_BYTES + 43,
        message: `${'A'.repeat(40)}${NOTE}`,
      },
      {
        name: 'keeps a complete emoji that fits before the limit',
        body: `😀${'C'.repeat(100)}`,
        limit: NOTE_BYTES + 20,
        message: `😀${'C'.repeat(16)}${NOTE}`,
      },
      {
        name: 'keeps only the truncation note when the limit leaves no room for text',
        body: 'B'.repeat(200),
        limit: 10,
        message: NOTE,
      },
    ];
    for (const { name, body, limit, ...expected } of cases) {
      it(name, async () => {
        await pollWith({
          maxStoredBodyBytes: limit,
          fetched: [item()],
          sources: [mimeMail({ body })],
        });
        const request = await firstRequest();
        assert.equal(request?.message, expected.message);
        if ('truncated' in expected) {
          assert.equal(request?.truncated, expected.truncated);
        }
        if ('oversized' in expected) {
          assert.equal(request?.oversized, expected.oversized);
        }
      });
    }
  });

  describe('senders and thread lookup', () => {
    it('ignores mail from the support address itself, in any case', async () => {
      await pollWith({
        fromAddress: 'Support@Trustroots.org',
        fetched: [item({ envelope: envelope({ from: [] }) })],
        sources: [mimeMail({ from: 'Support <support@trustroots.org>' })],
      });
      assert.equal(await SupportRequest.countDocuments(), 0);
      assert.equal((await cursorDoc())?.lastUid, 11);
    });

    it('ignores mail whose envelope address is the padded support address', async () => {
      await pollWith({
        fetched: [
          oversizedItem({
            envelope: envelope({
              from: [{ address: '  support@trustroots.org  ' }],
            }),
          }),
        ],
      });
      assert.equal(await SupportRequest.countDocuments(), 0);
    });

    it('prefers the From address over the envelope and trims envelope addresses', async () => {
      const fromItem = (uid: number, name: string, address: string) =>
        item({
          uid,
          envelope: envelope({
            messageId: `<from-${name}@example.org>`,
            from: [{ address }],
          }),
        });
      await pollWith({
        fetched: [
          fromItem(11, 'one', 'envelope@example.org'),
          fromItem(12, 'two', '  spaced@example.org  '),
        ],
        sources: [
          mimeMail({
            from: 'Header <header@example.org>',
            messageId: '<from-one@example.org>',
          }),
          mimeMail({
            from: 'undisclosed-recipients:;',
            messageId: '<from-two@example.org>',
          }),
        ],
      });
      assert.equal(
        (await requestFor('<from-one@example.org>'))?.email,
        'header@example.org',
      );
      assert.equal(
        (await requestFor('<from-two@example.org>'))?.email,
        'spaced@example.org',
      );
    });

    it('ignores an envelope without a From list when the message has no sender either', async () => {
      await pollWith({
        fetched: [item({ envelope: { messageId: '<no-from@example.org>' } })],
        sources: [mimeMail({ from: 'undisclosed-recipients:;' })],
      });
      assert.equal(await SupportRequest.countDocuments(), 0);
    });

    it('imports a message without an envelope, Message-ID, subject or thread headers', async () => {
      await pollWith({
        fetched: [item({ envelope: undefined })],
        sources: [mimeMail({ subject: null, messageId: null })],
      });
      const request = await firstRequest();
      assert.equal(request?.subject, 'Email support request');
      assert.equal(request?.initialMessageId, undefined);
      assert.equal(request?.initialInboundKey, 'imap:42:11');
    });

    it('attaches a reply found through References when there is no envelope, and stores no In-Reply-To', async () => {
      const thread = await seedThread();
      await pollWith({
        fetched: [item({ envelope: undefined })],
        sources: [
          mimeMail({
            headers: ['References: <root@example.org>'],
            messageId: null,
          }),
        ],
      });
      const reply = await SupportMessage.findOne({
        request: thread._id,
      }).lean();
      assert.ok(reply);
      assert.equal(reply.inReplyTo, undefined);
      assert.deepEqual(reply.references, ['<root@example.org>']);
    });

    it('stores the In-Reply-To from the message, else from the envelope, and the incoming Message-ID', async () => {
      const thread = await seedThread();
      await outbound(thread, '<earlier@example.org>');
      await pollWith(
        mails(
          ['<store-11@example.org>', IN_REPLY_TO_ROOT],
          ['<store-12@example.org>', [], { inReplyTo: '<root@example.org>' }],
          [
            '<store-13@example.org>',
            IN_REPLY_TO_ROOT,
            { inReplyTo: '<elsewhere@example.org>' },
          ],
        ),
      );
      const stored = await SupportMessage.find({ direction: 'inbound' })
        .sort({ inboundKey: 1 })
        .lean();
      assert.deepEqual(
        stored.map(message => [message.messageId, message.inReplyTo]),
        [
          ['<store-11@example.org>', '<root@example.org>'],
          ['<store-12@example.org>', '<root@example.org>'],
          ['<store-13@example.org>', '<root@example.org>'],
        ],
      );
    });

    it('uses the domain after the last @ of the support address for fallback Message-IDs', async () => {
      const thread = await seedThread();
      await pollWith({
        fromAddress: 'ops@desk@example.net',
        fetched: [itemWithId('not-an-id')],
        sources: [mimeMail({ headers: IN_REPLY_TO_ROOT, messageId: null })],
      });
      const reply = await SupportMessage.findOne({
        request: thread._id,
      }).lean();
      assert.match(String(reply?.messageId), /^<[\da-f-]{36}@example\.net>$/);
    });

    it('does not attach a fresh message to a request that has no initial Message-ID', async () => {
      const unrelated = await seedRequest();
      await pollWith({ fetched: [item()] });
      assert.equal(await SupportRequest.countDocuments(), 2);
      assert.equal(await messageCount({ request: unrelated._id }), 0);
    });

    it('does not attach a reply to a request just because other messages exist', async () => {
      const thread = await seedThread();
      await outbound(thread, '<earlier@example.org>');
      await pollWith(
        mails(
          [
            '<unknown-in-reply@example.org>',
            ['In-Reply-To: <unknown@example.org>'],
          ],
          [
            '<unknown-reference@example.org>',
            ['References: <unknown@example.org>'],
          ],
        ),
      );
      assert.equal(await SupportRequest.countDocuments(), 3);
      assert.equal(await messageCount({ direction: 'inbound' }), 0);
    });

    it('falls back to References only when the In-Reply-To matches no request', async () => {
      const first = await seedRequest({
        initialMessageId: '<shared@example.org>',
      });
      await seedRequest({ initialMessageId: '<shared@example.org>' });
      const unique = await seedRequest({
        initialMessageId: '<unique@example.org>',
      });
      const references = 'References: <unique@example.org>';
      await pollWith(
        mails(
          [
            '<ambiguous-first@example.org>',
            ['In-Reply-To: <shared@example.org>', references],
          ],
          [
            '<unknown-first@example.org>',
            ['In-Reply-To: <unknown@example.org>', references],
          ],
        ),
      );
      assert.equal(await messageCount({ request: unique._id }), 1);
      assert.equal(await messageCount({ request: first._id }), 0);
      assert.ok(await requestFor('<ambiguous-first@example.org>'));
    });

    it('does not attach mail to a request that has no email address', async () => {
      await SupportRequest.collection.insertOne({
        category: 'other',
        message: 'A legacy request without an address.',
        status: 'open',
        initialMessageId: '<legacy@example.org>',
        statusRevision: 0,
        sent: new Date('2024-01-01T00:00:00.000Z'),
      });
      await pollWith({
        fetched: [item()],
        sources: [mimeMail({ headers: ['In-Reply-To: <legacy@example.org>'] })],
      });
      assert.equal(await SupportRequest.countDocuments(), 2);
      assert.equal(await SupportMessage.countDocuments(), 0);
    });

    it('uses the message subject over the envelope subject', async () => {
      await pollWith({
        fetched: [
          item({ envelope: envelope({ subject: 'Envelope subject' }) }),
        ],
        sources: [mimeMail({ subject: 'Message subject' })],
      });
      assert.equal((await firstRequest())?.subject, 'Message subject');
    });
  });

  describe('activity on a reopened thread', () => {
    const pollReply = (messageId: string) =>
      pollWith(mails([messageId, IN_REPLY_TO_ROOT]));

    it('reopens a closed thread, stamps its status change and leaves other records alone', async () => {
      const closed = { status: 'closed', statusChangedAt: OLD };
      const other = await seedRequest(closed);
      const otherMessage = await outbound(other, '<unrelated@example.org>');
      const thread = await seedThread(closed);
      await pollReply('<reopen@example.org>');
      const reopened = await SupportRequest.findById(thread._id).lean();
      assert.equal(reopened?.status, 'open');
      assert.equal(reopened?.statusRevision, 1);
      assert.equal(iso(reopened?.statusChangedAt), ITEM_DATE);
      assert.equal(iso(reopened?.lastActivityAt), ITEM_DATE);
      const untouched = await SupportRequest.findById(other._id).lean();
      assert.equal(untouched?.status, 'closed');
      assert.equal(untouched?.statusRevision, 0);
      assert.equal(
        (await SupportMessage.findById(otherMessage._id).lean())
          ?.activityAppliedAt,
        undefined,
      );
    });

    it('keeps the status change time of a thread that is already open', async () => {
      const thread = await seedThread({ status: 'open', statusChangedAt: OLD });
      await pollReply('<already-open@example.org>');
      const updated = await SupportRequest.findById(thread._id).lean();
      assert.equal(iso(updated?.statusChangedAt), OLD.toISOString());
      assert.equal(iso(updated?.lastActivityAt), ITEM_DATE);
      assert.equal(updated?.statusRevision, 1);
    });

    /** Stores an inbound reply as if an earlier poll had imported it. */
    const replayed = (request: unknown, id: string, extra = {}) =>
      SupportMessage.create({
        request,
        direction: 'inbound',
        body: 'A fictional replayed reply.',
        messageId: id,
        inboundKey: id,
        deliveryState: 'received',
        requestRevision: 0,
        ...extra,
      } as never);

    it('does not apply the activity of an already applied replay again', async () => {
      const thread = await seedRequest({ status: 'closed' });
      await replayed(thread._id, '<applied@example.org>', {
        activityAppliedAt: OLD,
      });
      await pollWith({ fetched: [itemWithId('<applied@example.org>')] });
      const unchanged = await SupportRequest.findById(thread._id).lean();
      assert.equal(unchanged?.status, 'closed');
      assert.equal(unchanged?.statusRevision, 0);
    });

    it('marks a replay applied even when its request is gone', async () => {
      await replayed(new mongoose.Types.ObjectId(), '<orphan@example.org>');
      await pollWith({ fetched: [itemWithId('<orphan@example.org>')] });
      const message = await SupportMessage.findOne({
        inboundKey: '<orphan@example.org>',
      }).lean();
      assert.ok(message?.activityAppliedAt instanceof Date);
    });

    it('leaves a request without a revision alone when replaying a legacy message', async () => {
      const legacy = await SupportRequest.collection.insertOne({
        category: 'other',
        email: 'visitor@example.org',
        message: 'A legacy request without a revision.',
        status: 'closed',
        sent: new Date('2024-01-01T00:00:00.000Z'),
      });
      await SupportMessage.collection.insertOne({
        request: legacy.insertedId,
        direction: 'inbound',
        kind: 'reply',
        body: 'A legacy fictional reply.',
        createdAt: OLD,
        messageId: '<legacy-reply@example.org>',
        inboundKey: '<legacy-reply@example.org>',
        deliveryState: 'received',
        attempts: 0,
      });
      await pollWith({ fetched: [itemWithId('<legacy-reply@example.org>')] });
      assert.equal(
        (await SupportRequest.collection.findOne({ _id: legacy.insertedId }))
          ?.status,
        'closed',
      );
    });
  });

  describe('delivery status reports', () => {
    const dsn = (originalId?: string) =>
      multipart(
        DSN_TYPE,
        [
          'Content-Type: text/plain\r\n\r\nDelivery failed.',
          statusPart(
            [
              'Action: failed',
              ...(originalId ? [`Original-Message-ID: ${originalId}`] : []),
            ].join('\r\n'),
          ),
        ],
        [
          'From: Mail Delivery Subsystem <mailer-daemon@example.org>',
          'To: support@trustroots.org',
          'Subject: Delivery Status Notification',
          'Message-ID: <dsn@example.org>',
          'MIME-Version: 1.0',
        ],
      );
    const accepted = (request: Doc, messageId: string, extra = {}) =>
      outbound(request, messageId, { attempts: 1, ...extra });
    const bounce = (source: string, internalDate?: Date) =>
      pollWith({
        fetched: [itemWithId('<dsn@example.org>', { internalDate })],
        sources: [source],
      });

    it('fails only the referenced accepted message and reopens only its request', async () => {
      const bystander = await seedRequest({
        status: 'pending',
        statusRevision: 4,
      });
      const bystanderMessage = await accepted(
        bystander,
        '<bystander@example.org>',
      );
      const acceptedAt = new Date('2025-02-10T00:00:00.000Z');
      const request = await seedRequest({
        status: 'pending',
        statusRevision: 3,
        lastActivityAt: acceptedAt,
      });
      const bounced = await accepted(request, '<bounced@example.org>', {
        acceptedAt,
        requestRevision: 3,
      });
      const bouncedAt = new Date('2025-02-20T00:00:00.000Z');
      await bounce(dsn('<bounced@example.org>'), bouncedAt);

      const failed = await SupportMessage.findById(bounced._id).lean();
      assert.equal(failed?.deliveryState, 'failed');
      assert.equal(failed?.errorCode, 'delivery_bounced');
      const reopened = await SupportRequest.findById(request._id).lean();
      assert.equal(reopened?.status, 'open');
      assert.equal(reopened?.statusRevision, 4);
      assert.equal(iso(reopened?.statusChangedAt), bouncedAt.toISOString());
      assert.equal(iso(reopened?.lastActivityAt), bouncedAt.toISOString());
      assert.equal(
        (await SupportMessage.findById(bystanderMessage._id).lean())
          ?.deliveryState,
        'accepted',
      );
      const untouched = await SupportRequest.findById(bystander._id).lean();
      assert.equal(untouched?.status, 'pending');
      assert.equal(untouched?.statusRevision, 4);
    });

    it('does not fail an accepted message the report does not reference', async () => {
      const request = await seedRequest({ status: 'pending' });
      const message = await accepted(request, '<known@example.org>');
      await bounce(dsn('<different@example.org>'));
      assert.equal(
        (await SupportMessage.findById(message._id).lean())?.deliveryState,
        'accepted',
      );
      assert.equal(
        (await SupportRequest.findById(request._id).lean())?.status,
        'pending',
      );
    });

    it('does not match an accepted message that has no Message-ID when the report names none', async () => {
      const request = await seedRequest({ status: 'pending' });
      const inserted = await SupportMessage.collection.insertOne({
        request: request._id,
        direction: 'outbound',
        kind: 'reply',
        body: 'A fictional reply without an id.',
        deliveryState: 'accepted',
        attempts: 1,
      });
      await bounce(dsn());
      assert.equal(
        (await SupportMessage.collection.findOne({ _id: inserted.insertedId }))
          ?.deliveryState,
        'accepted',
      );
    });
  });

  describe('logging', () => {
    it('logs the cutover and the completed poll with their counts', async () => {
      const log = stubLog();
      mockMailbox({ uidValidity: '77' });
      await poll();
      assert.ok(
        log.calledWith(
          'info',
          'Support mailbox cutover initialised #vG2rJt',
          sinon.match({ uidValidity: '77' }),
        ),
      );

      await Cursor.updateOne(
        { _id: 'support-inbox' },
        { $set: { lastUid: 10, uidValidity: '77' } },
      );
      sinon.restore();
      const completed = stubLog();
      mockMailbox({
        uidValidity: '77',
        ...mails(['<log-one@example.org>'], ['<log-two@example.org>']),
      });
      await poll();
      assert.ok(loggedCompleted(completed, sinon.match({ processed: 2 })));
    });

    const failures: Array<[string, unknown, string]> = [
      ['a string code', 'FICTIONAL_CODE', 'FICTIONAL_CODE'],
      ['a long string code', 'C'.repeat(60), 'C'.repeat(50)],
      ['a non-string code', 42, 'mailbox_error'],
      ['no code', undefined, 'mailbox_error'],
    ];
    for (const [label, code, expected] of failures) {
      it(`logs a failed poll with ${label} as ${expected.length > 20 ? 'its first 50 characters' : expected}`, async () => {
        await seedCursor();
        const log = stubLog();
        const error = Object.assign(new Error('synthetic failure'), { code });
        mockMailbox({ fetched: [item()] }).download.rejects(error);
        await pollFailsWith(error);
        assert.ok(
          log.calledWith(
            'error',
            'Support mailbox poll failed #Kc8wQm',
            sinon.match({ errorCode: expected }),
          ),
        );
        assert.equal(loggedCompleted(log), false);
      });
    }

    const renewalFailures: Array<[string, MockOptions]> = [
      ['while renewing the lock', { fetched: [item()] }],
      [
        'after skipping a rescanned message',
        {
          uidValidity: '99',
          uidNext: 6,
          fetched: [item({ uid: 1, internalDate: OLD })],
        },
      ],
    ];
    for (const [label, options] of renewalFailures) {
      it(`does not report a poll as completed when the connection fails ${label}`, async () => {
        await seedCursor();
        const log = stubLog();
        const error = new Error('synthetic renewal failure');
        const mock = mockMailbox(options);
        await pollFailsWith(error, async () => {
          mock.client().emit('error', error);
        });
        assert.equal(loggedCompleted(log), false);
      });
    }
  });
});

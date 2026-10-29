import type { Types } from 'mongoose';
const { Readable } = require('node:stream') as typeof import('node:stream');

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const {
  parseSupportMailSource,
  pollSupportMailbox,
}: typeof import('../../server/jobs/poll-support-mailbox.server.job.mts') = require('../../server/jobs/poll-support-mailbox.server.job.mts');

interface RequestFixture {
  _id: Types.ObjectId;
  category: string;
  email: string;
  message: string;
  sent?: Date;
  status: string;
  subject?: string;
  initialMessageId?: string;
  initialInboundKey?: string;
  lastActivityAt?: Date;
  statusChangedAt?: Date;
  statusRevision: number;
  zendeskTicketId?: number;
  initialReferences?: string[];
  initialAttachments?: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>;
  oversized?: boolean;
  truncated?: boolean;
}

interface MessageFixture {
  _id?: Types.ObjectId;
  request: Types.ObjectId;
  direction: string;
  kind?: string;
  body: string;
  messageId: string;
  inboundKey?: string;
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>;
  oversized?: boolean;
  deliveryState?: string;
  errorCode?: string;
  attempts?: number;
  requestRevision?: number;
  activityAppliedAt?: Date;
}

interface CursorFixture {
  _id: string;
  uidValidity: string;
  lastUid: number;
  cutoverAt: Date;
  rescanThroughUid?: number;
}

const SupportRequest = mongoose.model<RequestFixture>('SupportRequest');
const SupportMessage = mongoose.model<MessageFixture>('SupportMessage');
const Cursor = mongoose.model<CursorFixture>('SupportMailboxCursor');
let ImapFlowClass: typeof import('imapflow').ImapFlow;

const ORIGINAL_INBOX = {
  ...config.supportInbox,
  imap: { ...config.supportInbox.imap },
};
const CUTOVER_AT = new Date('2025-01-01T00:00:00.000Z');

function mimeMail(
  overrides: { from?: string; body?: string; headers?: string } = {},
) {
  return [
    `From: ${overrides.from || 'Visitor <visitor@example.org>'}`,
    'To: Trustroots Support <support@trustroots.org>',
    'Subject: A fictional support message',
    'Message-ID: <incoming-1@example.org>',
    ...(overrides.headers ? [overrides.headers] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    overrides.body || 'Hello, this is a fictional support message.',
  ].join('\r\n');
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    from: [{ address: 'visitor@example.org', name: 'Visitor' }],
    subject: 'A fictional support message',
    messageId: '<incoming-1@example.org>',
    ...overrides,
  };
}

function fetchedItem(overrides: Record<string, unknown> = {}) {
  return {
    uid: 11,
    size: 200,
    envelope: envelope(),
    internalDate: new Date('2025-02-01T00:00:00.000Z'),
    bodyStructure: { type: 'text/plain', childNodes: [] },
    headers: Buffer.from(''),
    ...overrides,
  };
}

function enableMailbox(
  options: {
    uidValidity?: string;
    uidNext?: number;
    fetched?: object[];
    source?: string;
    sources?: string[];
    downloadError?: Error;
    logoutError?: Error;
    downloadGate?: Promise<void>;
    failCursorOnNextUpdate?: boolean;
    maxMessagesPerPoll?: number;
    fromAddress?: string;
    noDownloadContent?: boolean;
    openedMailbox?: boolean;
    maxStoredBodyBytes?: number;
    secure?: boolean;
  } = {},
) {
  config.supportInbox = {
    ...ORIGINAL_INBOX,
    enabled: true,
    imap: {
      ...ORIGINAL_INBOX.imap,
      enabled: true,
      host: 'imap.example.org',
      user: 'support@example.org',
      password: 'fictional-secret',
      ...(options.secure !== undefined && { secure: options.secure }),
      maxMessageBytes: 1000,
      ...(options.maxStoredBodyBytes !== undefined && {
        maxStoredBodyBytes: options.maxStoredBodyBytes,
      }),
      ...(options.maxMessagesPerPoll && {
        maxMessagesPerPoll: options.maxMessagesPerPoll,
      }),
    },
    ...(options.fromAddress !== undefined && {
      fromAddress: options.fromAddress,
    }),
  };
  let cursorUpdates = 0;
  let lockOptions: unknown;
  sinon.stub(ImapFlowClass.prototype, 'connect').resolves();
  const getMailboxLock = sinon
    .stub(ImapFlowClass.prototype, 'getMailboxLock')
    .callsFake(function (
      this: InstanceType<typeof ImapFlowClass>,
      _mailbox,
      lock,
    ) {
      lockOptions = lock;
      if (options.openedMailbox !== false) {
        Object.assign(this, {
          mailbox: {
            uidValidity: options.uidValidity ?? '42',
            uidNext: options.uidNext ?? 12,
          },
        });
      }
      return Promise.resolve({ path: 'INBOX', release() {} });
    });
  const logout = sinon
    .stub(ImapFlowClass.prototype, 'logout')
    .callsFake(async () => {
      if (options.logoutError) throw options.logoutError;
    });
  const deleteMessages = sinon
    .stub(ImapFlowClass.prototype, 'messageDelete')
    .resolves(true);
  const addFlags = sinon
    .stub(ImapFlowClass.prototype, 'messageFlagsAdd')
    .resolves(true);
  let fetchActive = false;
  sinon.stub(ImapFlowClass.prototype, 'fetch').callsFake(() => {
    const values = options.fetched || [];
    return (async function* () {
      fetchActive = true;
      try {
        for (const value of values) yield value;
      } finally {
        fetchActive = false;
      }
    })() as never;
  });
  const download = sinon.stub(ImapFlowClass.prototype, 'download');
  if (options.downloadError) download.rejects(options.downloadError);
  else if (options.noDownloadContent) download.resolves({} as never);
  else {
    let sourceIndex = 0;
    download.callsFake(async () => {
      assert.equal(fetchActive, false, 'downloads must follow FETCH iteration');
      await options.downloadGate;
      return {
        content: Readable.from([
          options.sources?.[sourceIndex++] || options.source || mimeMail(),
        ]),
      } as never;
    });
  }
  if (options.failCursorOnNextUpdate) {
    const originalUpdate = Cursor.updateOne.bind(Cursor);
    sinon.stub(Cursor, 'updateOne').callsFake((...args: unknown[]) => {
      cursorUpdates++;
      if (cursorUpdates > 0) throw new Error('synthetic cursor failure');
      return originalUpdate(...(args as Parameters<typeof Cursor.updateOne>));
    });
  }
  return {
    addFlags,
    deleteMessages,
    download,
    logout,
    lockOptions: () => lockOptions,
    client: () =>
      getMailboxLock.thisValues[0] as InstanceType<typeof ImapFlowClass>,
  };
}

async function poll(touch: () => Promise<void> = async () => undefined) {
  await new Promise<void>((resolve, reject) => {
    pollSupportMailbox({ attrs: {}, touch } as never, error =>
      error ? reject(error) : resolve(),
    );
  });
}

describe('support mailbox polling', () => {
  before(async () => {
    ImapFlowClass = (await import('imapflow')).ImapFlow;
  });

  beforeEach(async () => {
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

  it('does not connect when disabled and rejects incomplete credentials', async () => {
    const disabled = sinon.stub(ImapFlowClass.prototype, 'connect');
    await poll();
    assert.equal(disabled.called, false);
    sinon.restore();
    config.supportInbox = {
      ...ORIGINAL_INBOX,
      enabled: true,
      imap: { ...ORIGINAL_INBOX.imap, enabled: true },
    };
    await assert.rejects(poll(), /configuration is incomplete/);
  });

  it('refuses to poll an insecure mailbox connection', async () => {
    const insecure = enableMailbox({ secure: false });
    await assert.rejects(poll(), /requires TLS/);
    assert.equal(insecure.logout.called, false);
  });

  it('sets a read-only cutover at the current mailbox end on first activation', async () => {
    const mailbox = enableMailbox({ uidValidity: '', uidNext: 0 });
    await poll();
    assert.deepEqual(mailbox.lockOptions(), { readOnly: true });
    assert.equal(mailbox.deleteMessages.called, false);
    assert.equal(mailbox.addFlags.called, false);
    const cutover = await Cursor.findById('support-inbox').lean();
    assert.equal(cutover?.uidValidity, 'unknown');
    assert.equal(cutover?.lastUid, 0);
    assert.equal(await SupportRequest.countDocuments(), 0);
  });

  it('reports an IMAP error emitted during initial cutover logout', async () => {
    const mailboxError = new Error('synthetic cutover connection failure');
    const mailbox = enableMailbox({ uidNext: 20 });
    sinon.stub(ImapFlowClass.prototype, 'close').callsFake(() => undefined);
    mailbox.logout.callsFake(async () => {
      void mailbox.client()?.emit('error', mailboxError);
    });

    await assert.rejects(poll(), error => error === mailboxError);
    assert.equal(mailbox.logout.callCount, 2);
    const cursor = await Cursor.findById('support-inbox').lean();
    assert.equal(cursor?.lastUid, 19);
  });

  it('uses a zero UIDNext fallback when initialising a rescan cursor', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    enableMailbox({ uidValidity: '99', uidNext: 0, fetched: [] });
    await poll();
    const cursor = await Cursor.findById('support-inbox').lean();
    assert.equal(cursor?.lastUid, 0);
    assert.equal(cursor?.rescanThroughUid, 0);
  });

  it('reports logout errors and retries cleanup without masking the failure', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const logoutError = new Error('synthetic logout failure');
    const mailbox = enableMailbox({ logoutError });
    await assert.rejects(poll(), /synthetic logout failure/);
    assert.equal(mailbox.logout.callCount, 2);
  });

  it('releases the read-only lock when mailbox selection or message download fails', async () => {
    const unopened = enableMailbox({ openedMailbox: false });
    await assert.rejects(poll(), /could not be opened/);
    assert.equal(unopened.logout.calledOnce, true);

    sinon.restore();
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
      },
    };
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    enableMailbox({ fetched: [fetchedItem()], noDownloadContent: true });
    await assert.rejects(poll(), /message not found/);
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 10);

    sinon.restore();
    const codedError = Object.assign(new Error('synthetic network failure'), {
      code: 'FICTIONAL_CODE',
    });
    const codedFailure = enableMailbox({
      fetched: [fetchedItem()],
      downloadError: codedError,
    });
    await assert.rejects(poll(), /synthetic network failure/);
    assert.equal(codedFailure.logout.callCount, 1);
  });

  it('skips old UIDs and honours the per-poll message bound', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const mailbox = enableMailbox({
      maxMessagesPerPoll: 1,
      fetched: [
        fetchedItem({ uid: 10 }),
        fetchedItem({
          uid: 11,
          envelope: envelope({ messageId: '<first-bounded@example.org>' }),
        }),
        fetchedItem({
          uid: 12,
          envelope: envelope({ messageId: '<second-bounded@example.org>' }),
        }),
      ],
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 1);
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 11);
    assert.equal(mailbox.download.callCount, 1);
  });

  it('renews the Agenda job lock after each processed message', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({ messageId: '<touch-one@example.org>' }),
        }),
        fetchedItem({
          uid: 12,
          envelope: envelope({ messageId: '<touch-two@example.org>' }),
        }),
      ],
    });
    const touch = sinon.spy(async () => undefined);
    await poll(touch);
    assert.equal(touch.callCount, 2);
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 12);
  });

  it('imports a new direct message through the real MIME parser and records the cursor', async () => {
    const mailbox = enableMailbox({
      fetched: [fetchedItem()],
      source: mimeMail(),
    });
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    await poll();
    const request = await SupportRequest.findOne().lean();
    assert.equal(request?.email, 'visitor@example.org');
    assert.equal(
      request?.message,
      'Hello, this is a fictional support message.',
    );
    assert.equal(request?.status, 'new');
    assert.equal(request?.initialMessageId, '<incoming-1@example.org>');
    assert.deepEqual(request?.initialReferences, []);
    assert.equal(
      request?.lastActivityAt?.toISOString(),
      '2025-02-01T00:00:00.000Z',
    );
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 11);
    assert.equal(mailbox.download.calledOnce, true);
    assert.equal(mailbox.deleteMessages.called, false);
    assert.equal(mailbox.addFlags.called, false);
  });

  it('truncates stored text at its byte limit without splitting a Unicode character', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const bodyLimit =
      Buffer.byteLength('\n[Message text truncated after 0 MiB]') + 43;
    enableMailbox({
      maxStoredBodyBytes: bodyLimit,
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({ messageId: '<unicode-truncate@example.org>' }),
        }),
        fetchedItem({
          uid: 12,
          envelope: envelope({ messageId: '<plain-truncate@example.org>' }),
        }),
      ],
      sources: [
        mimeMail({ body: `${'A'.repeat(40)}😀${'more '.repeat(30)}` }).replace(
          '<incoming-1@example.org>',
          '<unicode-truncate@example.org>',
        ),
        mimeMail({ body: 'B'.repeat(200) }).replace(
          '<incoming-1@example.org>',
          '<plain-truncate@example.org>',
        ),
      ],
    });
    await poll();
    const unicodeRequest = await SupportRequest.findOne({
      initialMessageId: '<unicode-truncate@example.org>',
    }).lean();
    const plainRequest = await SupportRequest.findOne({
      initialMessageId: '<plain-truncate@example.org>',
    }).lean();
    const requests = [unicodeRequest, plainRequest];
    assert.ok(unicodeRequest && plainRequest);
    assert.equal(unicodeRequest.truncated, true);
    assert.equal(plainRequest.truncated, true);
    assert.ok(
      requests.every(request =>
        request?.message.endsWith('[Message text truncated after 0 MiB]'),
      ),
    );
    assert.ok(
      requests.every(
        request => request && Buffer.byteLength(request.message) <= bodyLimit,
      ),
    );
    assert.equal(unicodeRequest.message.endsWith('\uD83D'), false);
  });

  it('converts an HTML-only email to safe text content', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    enableMailbox({
      fetched: [fetchedItem()],
      source: [
        'From: Visitor <visitor@example.org>',
        'To: support@trustroots.org',
        'Subject: HTML-only fictional request',
        'Message-ID: <html-only@example.org>',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        '<p>Hello <strong>support team</strong>.</p>',
      ].join('\r\n'),
    });
    await poll();
    const request = await SupportRequest.findOne().lean();
    assert.match(request?.message || '', /Hello support team\./);
    assert.equal(request?.message.includes('<strong>'), false);
  });

  it('parses a bare text message with no Content-Type or References header', async () => {
    const parsed = await parseSupportMailSource(
      Readable.from(
        [
          'From: Visitor <visitor@example.org>',
          'Subject: A fictional message',
          '',
          'A fictional body.',
        ].join('\r\n'),
      ),
      1000,
    );
    assert.equal(parsed.body, 'A fictional body.');
    assert.equal(parsed.automated, false);
    assert.deepEqual(parsed.references, []);

    const repeatedHeaders = await parseSupportMailSource(
      Readable.from([
        mimeMail({
          headers: 'Auto-Submitted: no\r\nAuto-Submitted: auto-generated',
        }),
      ]),
      1000,
    );
    assert.equal(repeatedHeaders.automated, true);

    const oneReference = await parseSupportMailSource(
      Readable.from([
        mimeMail({ headers: 'References: <single-reference@example.org>' }),
      ]),
      1000,
    );
    assert.deepEqual(oneReference.references, [
      '<single-reference@example.org>',
    ]);

    const empty = await parseSupportMailSource(Readable.from([]), 1000);
    assert.equal(empty.body, '');
    assert.equal(empty.automated, false);
    assert.deepEqual(empty.references, []);
  });

  it('uses a safe placeholder for an empty message with an invalid IMAP date', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          size: undefined,
          internalDate: new Date('invalid'),
          envelope: envelope({ messageId: '<empty-body@example.org>' }),
          bodyStructure: undefined,
        }),
      ],
      source: [
        'From: Visitor <visitor@example.org>',
        'To: support@trustroots.org',
        'Subject: Empty fictional message',
        'Message-ID: <empty-body@example.org>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        '',
      ].join('\r\n'),
    });
    const before = Date.now();
    await poll();
    const request = await SupportRequest.findOne().lean();
    assert.equal(request?.message, '[Message body unavailable]');
    assert.ok(request?.sent && request.sent.getTime() >= before);
  });

  it('falls back safely for missing envelope IDs and senders', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const thread = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'An original fictional request.',
      status: 'open',
      initialMessageId: '<existing-thread@example.org>',
      sent: new Date('2024-01-01T00:00:00.000Z'),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    enableMailbox({
      fromAddress: '',
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({
            messageId: 'not-an-id',
            from: [{ address: 'visitor@example.org' }],
            subject: undefined,
          }),
        }),
        fetchedItem({
          uid: 12,
          envelope: envelope({
            messageId: '<self@example.org>',
            from: [],
          }),
        }),
        fetchedItem({
          uid: 13,
          envelope: envelope({
            messageId: 'invalid-reply-id',
            inReplyTo: '<existing-thread@example.org>',
          }),
        }),
      ],
      sources: [
        [
          'From: Visitor <visitor@example.org>',
          'To: support@trustroots.org',
          'MIME-Version: 1.0',
          'Content-Type: text/plain',
          '',
          'A fictional message with no message ID or subject.',
        ].join('\r\n'),
        [
          'To: support@trustroots.org',
          'MIME-Version: 1.0',
          'Content-Type: text/plain',
          '',
          'A fictional message with no sender or message ID.',
        ].join('\r\n'),
        [
          'From: Visitor <visitor@example.org>',
          'To: support@trustroots.org',
          'MIME-Version: 1.0',
          'Content-Type: text/plain',
          '',
          'A fictional reply without a message ID.',
        ].join('\r\n'),
      ],
    });
    await poll();
    const request = await SupportRequest.findOne({
      subject: 'Email support request',
    }).lean();
    assert.equal(await SupportRequest.countDocuments(), 2);
    assert.equal(request?.email, 'visitor@example.org');
    assert.equal(request?.subject, 'Email support request');
    assert.equal(request?.initialMessageId, undefined);
    assert.equal(
      await SupportMessage.countDocuments({ request: thread._id }),
      1,
    );
    const fallbackMessage = await SupportMessage.findOne({
      request: thread._id,
    }).lean();
    assert.match(
      fallbackMessage?.messageId || '',
      /^<[\da-f-]{36}@localhost>$/i,
    );
  });

  it('reopens a known same-sender thread, but files mismatched senders as unlinked requests', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const existing = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'Original fictional request.',
      status: 'closed',
      initialMessageId: '<initial@example.org>',
      sent: new Date('2024-01-01T00:00:00Z'),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({
            messageId: 'invalid-message-id',
            inReplyTo: '<initial@example.org>',
          }),
        }),
      ],
      source: [
        'From: Visitor <visitor@example.org>',
        'To: support@trustroots.org',
        'Subject: A fictional reply without a message ID',
        'In-Reply-To: <initial@example.org>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain',
        '',
        'A fictional reply without a message ID.',
      ].join('\r\n'),
    });
    await poll();
    assert.equal(
      await SupportMessage.countDocuments({ request: existing._id }),
      1,
    );
    const fallbackReply = await SupportMessage.findOne({
      request: existing._id,
    }).lean();
    assert.match(
      fallbackReply?.messageId || '',
      /^<[\da-f-]{36}@trustroots\.org>$/i,
    );
    const reopened = await SupportRequest.findById(existing._id).lean();
    assert.equal(reopened?.status, 'open');
    assert.equal(reopened?.statusRevision, 1);

    sinon.restore();
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
      },
    };
    await Cursor.updateOne({ _id: 'support-inbox' }, { $set: { lastUid: 11 } });
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 12,
          envelope: envelope({
            messageId: '<mismatched@example.org>',
            from: [{ address: 'stranger@example.org' }],
            inReplyTo: '<initial@example.org>',
          }),
        }),
      ],
      source: mimeMail({
        from: 'Stranger <stranger@example.org>',
        headers: 'In-Reply-To: <initial@example.org>',
      }),
    });
    await poll();
    const unlinked = await SupportRequest.findOne({
      email: 'stranger@example.org',
    }).lean();
    assert.equal(unlinked?.initialMessageId, '<incoming-1@example.org>');
    assert.equal(await SupportMessage.countDocuments({}), 1);
  });

  it('skips ambiguous references and deduplicates replays after UIDVALIDITY changes', async () => {
    const first = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'First fictional request.',
      status: 'open',
      initialMessageId: '<first@example.org>',
      sent: new Date(),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    const second = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'Second fictional request.',
      status: 'open',
      initialMessageId: '<first@example.org>',
      sent: new Date(),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({
            messageId: '<ambiguous@example.org>',
            inReplyTo: '<first@example.org>',
          }),
        }),
      ],
      source: mimeMail({
        headers: 'In-Reply-To: <first@example.org>',
      }),
    });
    await poll();
    assert.equal(await SupportMessage.countDocuments(), 0);
    assert.equal(await SupportRequest.countDocuments(), 3);
    const unlinked = await SupportRequest.findOne({
      initialMessageId: '<incoming-1@example.org>',
    }).lean();
    assert.equal(unlinked?.email, 'visitor@example.org');

    sinon.restore();
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
      },
    };
    await Cursor.updateOne({ _id: 'support-inbox' }, { $set: { lastUid: 11 } });
    enableMailbox({
      uidValidity: '99',
      fetched: [
        fetchedItem({
          uid: 12,
          envelope: envelope({ messageId: '<ambiguous@example.org>' }),
        }),
      ],
      source: mimeMail(),
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 3);
    assert.equal(
      (await Cursor.findById('support-inbox').lean())?.uidValidity,
      '99',
    );
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 12);
    assert.notEqual(first._id.toString(), second._id.toString());
  });

  it('bounds UIDVALIDITY rescans but imports fresh UIDs with older internal dates', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: new Date('2025-02-01T00:00:00.000Z'),
    });
    enableMailbox({
      uidValidity: '99',
      uidNext: 3,
      fetched: [
        fetchedItem({
          uid: 1,
          internalDate: new Date('2025-01-01T00:00:00.000Z'),
          envelope: envelope({ messageId: '<before-cutover@example.org>' }),
        }),
        fetchedItem({
          uid: 2,
          internalDate: new Date('2025-01-10T00:00:00.000Z'),
          envelope: envelope({
            messageId: '<also-before-cutover@example.org>',
          }),
        }),
        fetchedItem({
          uid: 3,
          internalDate: new Date('2025-01-15T00:00:00.000Z'),
          envelope: envelope({ messageId: '<fresh-old-date@example.org>' }),
        }),
      ],
      sources: [
        mimeMail({
          body: 'A fresh fictional message with an older date.',
        }).replace('<incoming-1@example.org>', '<fresh-old-date@example.org>'),
      ],
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 1);
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 3);
    assert.equal(
      (await Cursor.findById('support-inbox').lean())?.rescanThroughUid,
      undefined,
    );
    assert.equal(
      (await SupportRequest.findOne().lean())?.message,
      'A fresh fictional message with an older date.',
    );
  });

  it('resolves a unique References header and leaves conflicting references unlinked', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'A fictional original request.',
      status: 'open',
      initialMessageId: '<reference-one@example.org>',
      sent: new Date('2024-01-01T00:00:00.000Z'),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          size: 5000,
          envelope: envelope({
            messageId: '<unique-reference@example.org>',
          }),
          headers: Buffer.from('REFERENCES: <reference-one@example.org>'),
          bodyStructure: { type: 'text/plain', childNodes: [] },
        }),
      ],
    });
    await poll();
    assert.equal(
      await SupportMessage.countDocuments({ request: request._id }),
      1,
    );
    assert.equal(await SupportRequest.countDocuments(), 1);

    sinon.restore();
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
      },
    };
    const other = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'A second fictional original request.',
      status: 'open',
      initialMessageId: '<reference-two@example.org>',
      sent: new Date('2024-01-02T00:00:00.000Z'),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    await Cursor.updateOne({ _id: 'support-inbox' }, { $set: { lastUid: 11 } });
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 12,
          size: 5000,
          envelope: envelope({
            messageId: '<ambiguous-reference@example.org>',
          }),
          headers: Buffer.from(
            'REFERENCES: <reference-one@example.org> <reference-two@example.org>',
          ),
          bodyStructure: { type: 'text/plain', childNodes: [] },
        }),
      ],
    });
    await poll();
    const unlinked = await SupportRequest.findOne({
      initialInboundKey: '<ambiguous-reference@example.org>',
    }).lean();
    assert.equal(unlinked?.email, 'visitor@example.org');
    assert.notEqual(unlinked?._id.toString(), request._id.toString());
    assert.notEqual(unlinked?._id.toString(), other._id.toString());
    assert.equal(await SupportRequest.countDocuments(), 3);
  });

  it('resolves an exact reply Message-ID to the original request', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'An original fictional request.',
      status: 'pending',
      statusRevision: 2,
      initialMessageId: '<thread-root@example.org>',
      sent: new Date('2024-01-01T00:00:00.000Z'),
    } as never)) as unknown as RequestFixture;
    await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A fictional support reply.',
      messageId: '<known-reply@example.org>',
      deliveryState: 'accepted',
      attempts: 1,
    });
    enableMailbox({
      fetched: [fetchedItem()],
      source: mimeMail({
        headers: 'In-Reply-To: <known-reply@example.org>',
        body: 'A fictional follow-up.',
      }),
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 1);
    assert.equal(
      await SupportMessage.countDocuments({
        request: request._id,
        direction: 'inbound',
      }),
      1,
    );
    assert.equal(
      (await SupportRequest.findById(request._id).lean())?.status,
      'open',
    );
  });

  it('keeps the inbound key when an incoming reply reuses an outbound ID', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'An original fictional request.',
      status: 'open',
      initialMessageId: '<collision-root@example.org>',
      sent: new Date('2024-01-01T00:00:00.000Z'),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A fictional outbound reply.',
      messageId: '<reused-id@example.org>',
      deliveryState: 'accepted',
      attempts: 1,
    });
    const firstSource = mimeMail({
      headers: 'In-Reply-To: <collision-root@example.org>',
      body: 'A reply that reuses the outbound ID.',
    }).replace('<incoming-1@example.org>', '<reused-id@example.org>');
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({
            messageId: '<reused-id@example.org>',
            inReplyTo: '<collision-root@example.org>',
          }),
        }),
        fetchedItem({
          uid: 12,
          envelope: envelope({
            messageId: '<following@example.org>',
            inReplyTo: '<collision-root@example.org>',
          }),
        }),
      ],
      sources: [
        firstSource,
        mimeMail({
          headers: 'In-Reply-To: <collision-root@example.org>',
          body: 'The following fictional reply.',
        }).replace('<incoming-1@example.org>', '<following@example.org>'),
      ],
    });
    await poll();

    const firstInbound = await SupportMessage.findOne({
      direction: 'inbound',
      inboundKey: '<reused-id@example.org>',
    }).lean();
    assert.ok(firstInbound);
    assert.match(firstInbound.messageId, /^<[\da-f-]{36}@trustroots\.org>$/i);
    assert.equal(firstInbound.inboundKey, '<reused-id@example.org>');
    assert.equal(
      await SupportMessage.countDocuments({
        direction: 'inbound',
        request: request._id,
      }),
      2,
    );
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 12);

    await Cursor.updateOne({ _id: 'support-inbox' }, { $set: { lastUid: 10 } });
    sinon.restore();
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
      },
    };
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({
            messageId: '<reused-id@example.org>',
            inReplyTo: '<collision-root@example.org>',
          }),
        }),
      ],
      source: firstSource,
    });
    await poll();
    assert.equal(
      await SupportMessage.countDocuments({
        direction: 'inbound',
        inboundKey: '<reused-id@example.org>',
      }),
      1,
    );
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 11);
  });

  it('reports an IMAP error emitted during download and leaves the cursor unchanged', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const mailboxError = Object.assign(
      new Error('synthetic IMAP connection failure'),
      { code: 'FICTIONAL_IMAP_ERROR' },
    );
    const mailbox = enableMailbox({ fetched: [fetchedItem()] });
    sinon.stub(ImapFlowClass.prototype, 'close').callsFake(() => undefined);
    mailbox.download.callsFake(async () => {
      void mailbox.client()?.emit('error', mailboxError);
      return {
        content: Readable.from([mimeMail()]),
      } as never;
    });

    await assert.rejects(poll(), error => error === mailboxError);
    assert.ok(mailbox.client());
    assert.equal(mailbox.logout.called, true);
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 10);
    assert.equal(await SupportRequest.countDocuments(), 0);
  });

  it('does not attach a reply header that matches multiple original requests', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    await SupportRequest.create([
      {
        category: 'other',
        email: 'first@example.org',
        message: 'A first fictional request.',
        status: 'open',
        initialMessageId: '<ambiguous-root@example.org>',
      },
      {
        category: 'other',
        email: 'second@example.org',
        message: 'A second fictional request.',
        status: 'open',
        initialMessageId: '<ambiguous-root@example.org>',
      },
    ] as never);
    const ambiguousSource = mimeMail({
      headers: 'In-Reply-To: <ambiguous-root@example.org>',
      body: 'A fictional ambiguous reply.',
    });
    const parsedAmbiguous = await parseSupportMailSource(
      Readable.from([ambiguousSource]),
      1000,
    );
    assert.equal(parsedAmbiguous.inReplyTo, '<ambiguous-root@example.org>');
    enableMailbox({
      fetched: [
        fetchedItem(),
        fetchedItem({
          uid: 12,
          envelope: envelope({
            messageId: '<unknown-reply-header@example.org>',
            inReplyTo: '<unknown-thread@example.org>',
          }),
        }),
      ],
      sources: [
        ambiguousSource,
        mimeMail({
          headers: 'In-Reply-To: <unknown-thread@example.org>',
          body: 'A fictional message with an unknown reply header.',
        }).replace(
          '<incoming-1@example.org>',
          '<unknown-reply-header@example.org>',
        ),
      ],
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 4);
    assert.equal(await SupportMessage.countDocuments(), 0);
    assert.equal(
      (
        await SupportRequest.findOne({
          initialMessageId: '<incoming-1@example.org>',
        }).lean()
      )?.email,
      'visitor@example.org',
    );
  });

  it('resolves a References header that names a stored support reply', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'An original fictional request.',
      status: 'pending',
      statusRevision: 2,
      initialMessageId: '<thread-root@example.org>',
      sent: new Date('2024-01-01T00:00:00.000Z'),
    } as never)) as unknown as RequestFixture;
    await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      body: 'A fictional support reply.',
      messageId: '<reference-reply@example.org>',
      deliveryState: 'accepted',
      attempts: 1,
    });
    enableMailbox({
      fetched: [fetchedItem()],
      source: mimeMail({
        headers: 'References: <reference-reply@example.org>',
        body: 'A fictional follow-up.',
      }),
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 1);
    assert.equal(
      await SupportMessage.countDocuments({
        request: request._id,
        direction: 'inbound',
      }),
      1,
    );
  });

  it('marks a legacy inbound replay applied when it has no request revision', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'A legacy fictional request.',
      status: 'open',
      initialMessageId: '<legacy-root@example.org>',
      sent: new Date('2024-01-01T00:00:00.000Z'),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    await SupportMessage.collection.insertOne({
      request: request._id,
      direction: 'inbound',
      kind: 'reply',
      body: 'A previously received fictional message.',
      createdAt: new Date('2025-01-15T00:00:00.000Z'),
      messageId: '<legacy-replay@example.org>',
      inboundKey: '<legacy-replay@example.org>',
      deliveryState: 'received',
      attempts: 0,
    });
    enableMailbox({
      fetched: [
        fetchedItem({
          envelope: envelope({
            messageId: '<legacy-replay@example.org>',
          }),
        }),
      ],
      source: mimeMail({ body: 'A previously received fictional message.' }),
    });
    await poll();
    const message = await SupportMessage.findOne({
      request: request._id,
    }).lean();
    assert.equal(message?.requestRevision, undefined);
    assert.ok(message?.activityAppliedAt instanceof Date);
    assert.equal(
      await SupportMessage.countDocuments({ request: request._id }),
      1,
    );
    assert.equal(
      (await SupportRequest.findById(request._id).lean())?.status,
      'open',
    );
  });

  it('uses metadata for oversized and attachment messages without storing file contents', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const mailbox = enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          size: 5000,
          bodyStructure: {
            type: 'multipart/mixed',
            childNodes: [
              {
                type: 'application/octet-stream',
                size: 4000,
                disposition: 'attachment',
                dispositionParameters: { filename: 'fictional.txt' },
              },
            ],
          },
        }),
      ],
    });
    await poll();
    const request = await SupportRequest.findOne().lean();
    assert.equal(request?.oversized, true);
    assert.equal(
      request?.message,
      '[Message exceeds configured size limit; content omitted]',
    );
    assert.deepEqual(
      request?.initialAttachments?.map(({ filename, contentType, size }) => ({
        filename,
        contentType,
        size,
      })),
      [
        {
          filename: 'fictional.txt',
          contentType: 'application/octet-stream',
          size: 4000,
        },
      ],
    );
    assert.equal(mailbox.download.called, false);

    sinon.restore();
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
      },
    };
    await Cursor.updateOne({ _id: 'support-inbox' }, { $set: { lastUid: 11 } });
    enableMailbox({
      fetched: [
        fetchedItem({
          uid: 12,
          envelope: envelope({
            messageId: '<attachment@example.org>',
            from: [{ address: 'attachment@example.org' }],
          }),
        }),
      ],
      source: [
        'From: Visitor <attachment@example.org>',
        'To: support@trustroots.org',
        'Subject: Fictional attachment',
        'Message-ID: <attachment@example.org>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="fictional-boundary"',
        '',
        '--fictional-boundary',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        'A fictional note.',
        '--fictional-boundary',
        'Content-Type: text/plain; name="fictional.txt"',
        'Content-Disposition: attachment; filename="fictional.txt"',
        'Content-Transfer-Encoding: base64',
        '',
        'cHJpdmF0ZS1jb250ZW50',
        '--fictional-boundary--',
      ].join('\r\n'),
    });
    await poll();
    const attached = await SupportRequest.findOne({
      email: 'attachment@example.org',
    }).lean();
    assert.ok(attached, JSON.stringify(await SupportRequest.find().lean()));
    assert.deepEqual(
      attached?.initialAttachments?.map(item => item.filename),
      ['fictional.txt'],
    );
    assert.equal(
      JSON.stringify(attached?.initialAttachments).includes('private-content'),
      false,
    );

    sinon.restore();
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
      },
    };
    await Cursor.updateOne({ _id: 'support-inbox' }, { $set: { lastUid: 12 } });
    const noMetadata = enableMailbox({
      fetched: [
        fetchedItem({
          uid: 13,
          size: 5000,
          envelope: undefined,
          headers: undefined,
          bodyStructure: undefined,
        }),
      ],
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 2);
    assert.equal(noMetadata.download.called, false);
  });

  it('does not advance the cursor when persistence fails, then recovers on replay', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const source = mimeMail({ body: 'A recovered fictional message.' });
    enableMailbox({
      fetched: [fetchedItem()],
      source,
      failCursorOnNextUpdate: true,
    });
    await assert.rejects(poll(), /synthetic cursor failure/);
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 10);

    sinon.restore();
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
      },
    };
    enableMailbox({ fetched: [fetchedItem()], source });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 1);
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 11);
  });

  it('recovers thread activity when the inbound message saved but the request update failed', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'An original fictional request.',
      status: 'closed',
      initialMessageId: '<thread@example.org>',
      sent: new Date('2024-01-01T00:00:00.000Z'),
      statusRevision: 0,
    } as never)) as unknown as RequestFixture;
    const options = {
      fetched: [
        fetchedItem({
          envelope: envelope({
            messageId: '<recover@example.org>',
            inReplyTo: '<thread@example.org>',
          }),
        }),
      ],
      source: mimeMail({
        headers: 'In-Reply-To: <thread@example.org>',
        body: 'A fictional reply that will replay.',
      }),
    };
    enableMailbox(options);
    sinon
      .stub(SupportRequest, 'updateOne')
      .rejects(new Error('synthetic update failure'));
    await assert.rejects(poll(), /synthetic update failure/);
    assert.equal(
      await SupportMessage.countDocuments({ request: request._id }),
      1,
    );
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 10);

    sinon.restore();
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
      },
    };
    enableMailbox(options);
    await poll();
    const recovered = await SupportRequest.findById(request._id).lean();
    assert.equal(recovered?.status, 'open');
    assert.equal(recovered?.statusRevision, 1);
    assert.equal(
      recovered?.lastActivityAt?.toISOString(),
      '2025-02-01T00:00:00.000Z',
    );
    assert.equal(
      await SupportMessage.countDocuments({ request: request._id }),
      1,
    );
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 11);

    await Cursor.updateOne({ _id: 'support-inbox' }, { $set: { lastUid: 10 } });
    sinon.restore();
    enableMailbox(options);
    await poll();
    assert.equal(
      (await SupportRequest.findById(request._id).lean())?.statusRevision,
      1,
    );
    assert.equal(
      await SupportMessage.countDocuments({ request: request._id }),
      1,
    );
  });

  it('skips automated mail and delivery status notifications', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const deliveryReport = [
      'From: Visitor <visitor@example.org>',
      'To: support@trustroots.org',
      'Subject: Delivery status notification',
      'Message-ID: <fictional-dsn@example.org>',
      'MIME-Version: 1.0',
      'Content-Type: multipart/report; report-type=delivery-status; boundary="fictional"',
      '',
      '--fictional',
      'Content-Type: text/plain',
      '',
      'Delivery failed for a fictional message.',
      '--fictional',
      'Content-Type: message/delivery-status',
      '',
      'Action: failed',
      'Original-Message-ID: <outbound@example.org>',
      '--fictional--',
    ].join('\r\n');
    const parsedReport = await parseSupportMailSource(
      Readable.from(
        deliveryReport
          .replace(
            'Original-Message-ID: <outbound@example.org>',
            `Original-Message-ID: <outbound@example.org>\r\nX-Padding: ${'x'.repeat(65_536)}\r\nX-End: bounded`,
          )
          .match(/[\s\S]{1,4096}/g) || [],
      ),
      1000,
    );
    assert.equal(parsedReport.automated, true);
    assert.equal(parsedReport.deliveryStatus, 'failed');
    assert.equal(parsedReport.reportedMessageId, '<outbound@example.org>');
    const mailbox = enableMailbox({
      fetched: [
        fetchedItem({
          uid: 11,
          envelope: envelope({ messageId: '<auto@example.org>' }),
        }),
        fetchedItem({
          uid: 12,
          envelope: envelope({
            messageId: '<dsn@example.org>',
            from: [{ address: 'visitor@example.org' }],
          }),
        }),
        fetchedItem({
          uid: 13,
          size: 5000,
          envelope: envelope({
            messageId: '<large-dsn@example.org>',
            from: [{ address: 'mailer-daemon@example.org' }],
          }),
          headers: Buffer.from(
            'Content-Type: multipart/report; report-type=delivery-status\r\n',
          ),
        }),
      ],
      sources: [
        mimeMail({ headers: 'Auto-Submitted: auto-generated' }),
        deliveryReport,
      ],
    });
    await poll();
    assert.equal(
      await SupportRequest.countDocuments(),
      0,
      JSON.stringify(await SupportRequest.find().lean()),
    );
    assert.equal((await Cursor.findById('support-inbox').lean())?.lastUid, 13);
    assert.equal(mailbox.download.callCount, 2);
  });

  it('marks a known accepted outbound message failed and reopens its pending request on a DSN', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const acceptedAt = new Date('2025-02-01T00:00:00.000Z');
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'A fictional support request.',
      status: 'pending',
      statusChangedAt: acceptedAt,
      statusRevision: 3,
      sent: new Date('2025-01-01T00:00:00.000Z'),
    } as never)) as unknown as RequestFixture;
    const outbound = (await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A fictional sent reply.',
      createdAt: acceptedAt,
      emailFrom: 'support@trustroots.org',
      emailTo: 'visitor@example.org',
      messageId: '<outbound@example.org>',
      deliveryState: 'accepted',
      attempts: 1,
      requestRevision: 3,
    } as never)) as unknown as MessageFixture;
    const deliveryReport = [
      'From: Visitor <visitor@example.org>',
      'To: support@trustroots.org',
      'Subject: Delivery status notification',
      'Message-ID: <known-dsn@example.org>',
      'MIME-Version: 1.0',
      'Content-Type: multipart/report; report-type=delivery-status; boundary="fictional"',
      '',
      '--fictional',
      'Content-Type: text/plain',
      '',
      'Delivery failed for a fictional reply.',
      '--fictional',
      'Content-Type: message/delivery-status',
      '',
      'Action: failed',
      'Original-Message-ID: <outbound@example.org>',
      '--fictional--',
    ].join('\r\n');
    enableMailbox({
      fetched: [
        fetchedItem({
          internalDate: undefined,
          envelope: envelope({ messageId: '<known-dsn@example.org>' }),
        }),
      ],
      source: deliveryReport,
    });
    await poll();
    const updatedOutbound = await SupportMessage.findById(outbound._id).lean();
    const updatedRequest = await SupportRequest.findById(request._id).lean();
    assert.equal(updatedOutbound?.deliveryState, 'failed');
    assert.equal(updatedOutbound?.errorCode, 'delivery_bounced');
    assert.equal(updatedRequest?.status, 'open');
    assert.equal(updatedRequest?.statusRevision, 4);
    assert.ok(updatedRequest?.lastActivityAt instanceof Date);
    assert.equal(await SupportRequest.countDocuments(), 1);
  });

  it('ignores a failed delivery report with no reference to an outbound message', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    enableMailbox({
      fetched: [
        fetchedItem({
          envelope: envelope({ messageId: '<unmatched-dsn@example.org>' }),
        }),
      ],
      source: [
        'From: Mail Delivery Subsystem <mailer-daemon@example.org>',
        'To: support@trustroots.org',
        'Subject: Delivery Status Notification',
        'Message-ID: <unmatched-dsn@example.org>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/report; report-type=delivery-status; boundary="fictional"',
        '',
        '--fictional',
        'Content-Type: text/plain',
        '',
        'Delivery failed.',
        '--fictional',
        'Content-Type: message/delivery-status',
        '',
        'Action: failed',
        '--fictional--',
      ].join('\r\n'),
    });
    await poll();
    assert.equal(await SupportRequest.countDocuments(), 0);
    assert.equal(await SupportMessage.countDocuments(), 0);
  });

  it('ignores a DSN when its accepted outbound state changed before the conditional update', async () => {
    await Cursor.create({
      _id: 'support-inbox',
      uidValidity: '42',
      lastUid: 10,
      cutoverAt: CUTOVER_AT,
    });
    const request = (await SupportRequest.create({
      category: 'other',
      email: 'visitor@example.org',
      message: 'An original fictional request.',
      status: 'pending',
      statusRevision: 3,
      lastActivityAt: new Date('2025-01-10T00:00:00.000Z'),
    } as never)) as unknown as RequestFixture;
    const outbound = (await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A fictional support reply.',
      messageId: '<raced-reply@example.org>',
      deliveryState: 'accepted',
      attempts: 1,
      requestRevision: 3,
      acceptedAt: new Date('2025-01-10T00:00:00.000Z'),
    } as never)) as unknown as MessageFixture;
    sinon
      .stub(SupportMessage, 'updateOne')
      .resolves({ modifiedCount: 0 } as never);
    enableMailbox({
      fetched: [
        fetchedItem({
          envelope: envelope({ messageId: '<raced-dsn@example.org>' }),
        }),
      ],
      source: [
        'From: Mail Delivery Subsystem <mailer-daemon@example.org>',
        'To: support@trustroots.org',
        'Subject: Delivery Status Notification',
        'Message-ID: <raced-dsn@example.org>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/report; report-type=delivery-status; boundary="fictional"',
        '',
        '--fictional',
        'Content-Type: text/plain',
        '',
        'Delivery failed.',
        '--fictional',
        'Content-Type: message/delivery-status',
        '',
        'Action: failed',
        'Original-Message-ID: <raced-reply@example.org>',
        '--fictional--',
      ].join('\r\n'),
    });
    await poll();
    assert.ok(await SupportMessage.findById(outbound._id));
    assert.equal(
      (await SupportRequest.findById(request._id).lean())?.status,
      'pending',
    );
  });
});

const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const sendJob: typeof import('../../server/jobs/send-support-message.server.job.mts') = require('../../server/jobs/send-support-message.server.job.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

interface SupportMessageFields {
  deliveryState?: string;
  errorCode?: string;
  attempts?: number;
  lastAttemptAt?: Date;
  acceptedAt?: Date;
  requestActivityAt?: Date;
  activityAppliedAt?: Date;
  [field: string]: unknown;
}
interface SupportRequestFields {
  status?: string;
  statusRevision?: number;
  [field: string]: unknown;
}
type ObjectId = import('mongoose').Types.ObjectId;
const SupportRequest = mongoose.model<SupportRequestFields>('SupportRequest');
const SupportMessage = mongoose.model<SupportMessageFields>('SupportMessage');
const originalMailerOptions = config.mailer.options;
const originalInbox = { ...config.supportInbox };

type SentMail = Record<string, unknown>;
type MailInfo = { accepted?: string[] } | undefined;

let sequence = 0;

function run(data?: { messageId: string }) {
  return new Promise<void>((resolve, reject) => {
    sendJob.sendSupportMessage({ attrs: { data } } as never, error =>
      error ? reject(error) : resolve(),
    );
  });
}

const send = (message: { _id: ObjectId }) =>
  run({ messageId: String(message._id) });

/** A fake SMTP transport that records the mail it is handed. */
function transport(
  info: MailInfo = { accepted: ['fictional@example.org'] },
  closes: { count: number; fail?: boolean } = { count: 0 },
) {
  const sent: SentMail[] = [];
  config.mailer.options = {
    send: (
      mail: { data: object },
      callback: (error?: Error | null, info?: unknown) => void,
    ) => {
      sent.push(mail.data as SentMail);
      callback(null, info);
    },
    close: () => {
      closes.count += 1;
      if (closes.fail) throw new Error('Close failed');
    },
  } as typeof config.mailer.options;
  return { sent, closes };
}

function failingTransport(error: Error) {
  config.mailer.options = {
    send: (_mail: unknown, callback: (error?: Error | null) => void) =>
      callback(error),
  };
}

const outcome = (message: { deliveryState?: string; errorCode?: string }) => [
  message.deliveryState,
  message.errorCode,
];

const rejectedWith = (fields: Record<string, unknown>) =>
  Object.assign(new Error('Rejected'), fields);

describe('Support message send job', () => {
  let requestId: ObjectId;

  async function message(patch: Record<string, unknown> = {}) {
    return SupportMessage.create({
      request: requestId,
      direction: 'outbound',
      kind: 'reply',
      body: 'Fictional reply',
      emailTo: 'fictional@example.org',
      messageId: `<fictional-send-${++sequence}@example.org>`,
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 0,
      ...patch,
    });
  }

  async function saved(id: ObjectId) {
    const found = await SupportMessage.findById(id).lean();
    assert.ok(found);
    return found;
  }

  const stateOf = async (doc: { _id: ObjectId }) =>
    (await saved(doc._id)).deliveryState;

  const updateRequest = (update: Record<string, unknown>) =>
    SupportRequest.updateOne({ _id: requestId }, update);

  const setSubject = (subject: string) => updateRequest({ $set: { subject } });

  /** Sends a fresh reply (or `patch`ed message) and returns its saved state. */
  async function sendNew(patch: Record<string, unknown> = {}) {
    const doc = await message(patch);
    await send(doc);
    return { doc, after: await saved(doc._id) };
  }

  beforeEach(async () => {
    config.supportInbox.enabled = true;
    config.supportInbox.fromName = 'Fictional Support';
    config.supportInbox.fromAddress = 'support@example.org';
    requestId = (
      await SupportRequest.create({
        category: 'other',
        email: 'fictional@example.org',
        message: 'Fictional request',
        status: 'open',
        statusRevision: 0,
      })
    )._id;
  });

  afterEach(async () => {
    sinon.restore();
    config.mailer.options = originalMailerOptions;
    Object.assign(config.supportInbox, originalInbox);
    await utils.clearDatabase();
  });

  describe('claiming', () => {
    it('does nothing without a message id', async () => {
      const queued = await message();
      const update = sinon.spy(SupportMessage, 'updateOne');
      const claim = sinon.spy(SupportMessage, 'findOneAndUpdate');
      await run();
      await run({ messageId: '' });
      assert.equal(update.callCount, 0);
      assert.equal(claim.callCount, 0);
      assert.equal(await stateOf(queued), 'queued');
    });

    it('fails only the addressed queued message while the inbox is disabled', async () => {
      config.supportInbox.enabled = false;
      const first = await message();
      const target = await message();
      const accepted = await message({ deliveryState: 'accepted' });
      await send(target);
      await send(accepted);
      assert.equal(await stateOf(first), 'queued');
      const failed = await saved(target._id);
      assert.deepEqual(outcome(failed), ['failed', 'inbox_disabled']);
      assert.equal(await stateOf(accepted), 'accepted');
    });

    it('claims only the addressed queued message', async () => {
      transport();
      const first = await message();
      const { after: claimed } = await sendNew();
      const untouched = await saved(first._id);
      assert.equal(untouched.deliveryState, 'queued');
      assert.equal(untouched.attempts, 0);
      assert.equal(untouched.lastAttemptAt, undefined);
      assert.equal(claimed.attempts, 1);
      assert.ok(claimed.lastAttemptAt);
    });

    it('leaves a message another worker is already sending alone', async () => {
      const { sent } = transport();
      const { after } = await sendNew({
        deliveryState: 'sending',
        attempts: 1,
      });
      assert.equal(after.deliveryState, 'sending');
      assert.equal(after.attempts, 1);
      assert.equal(sent.length, 0);
    });

    it('marks a message failed when the request or recipient is gone', async () => {
      const { sent } = transport();
      const bystander = await message({ deliveryState: 'sending' });
      const targets = [
        await message({ emailTo: undefined }),
        await message({ request: new mongoose.Types.ObjectId() }),
      ];
      for (const target of targets) await send(target);
      for (const target of targets) {
        const failed = await saved(target._id);
        assert.deepEqual(outcome(failed), ['failed', 'recipient_missing']);
      }
      assert.equal(await stateOf(bystander), 'sending');
      assert.equal(sent.length, 0);
    });
  });

  describe('composing the email', () => {
    it('sends a reply from the support address with the message headers', async () => {
      const { sent } = transport();
      await setSubject('Hello there');
      const { doc } = await sendNew({
        inReplyTo: '<previous@example.org>',
        references: ['<first@example.org>', '<previous@example.org>'],
      });
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].from, {
        name: 'Fictional Support',
        address: 'support@example.org',
      });
      assert.equal(sent[0].to, 'fictional@example.org');
      assert.equal(sent[0].replyTo, 'support@example.org');
      assert.equal(sent[0].subject, 'Re: Hello there');
      assert.equal(sent[0].text, 'Fictional reply');
      assert.equal(sent[0].messageId, doc.messageId);
      assert.equal(sent[0].inReplyTo, '<previous@example.org>');
      assert.deepEqual(sent[0].references, [
        '<first@example.org>',
        '<previous@example.org>',
      ]);
      assert.deepEqual(sent[0].headers ?? {}, {});
    });

    it('omits threading headers when the message has none', async () => {
      const { sent } = transport();
      await sendNew();
      assert.equal('inReplyTo' in sent[0], false);
      assert.equal('references' in sent[0], false);
      assert.deepEqual(sent[0].headers ?? {}, {});
    });

    it('marks acknowledgements as automatic replies', async () => {
      const { sent } = transport();
      await setSubject('Hello there');
      await sendNew({ kind: 'acknowledgement' });
      assert.equal(sent[0].subject, 'We received your message: Hello there');
      assert.deepEqual(sent[0].headers, {
        'Auto-Submitted': 'auto-replied',
        'X-Auto-Response-Suppress': 'All',
      });
    });

    it('falls back to a default subject and flattens line breaks', async () => {
      const { sent } = transport();
      await sendNew();
      assert.equal(sent[0].subject, 'Re: your message to Trustroots Support');

      await setSubject('  Hello\r\nthere\n\nfriend  ');
      await sendNew();
      assert.equal(sent[1].subject, 'Re: Hello there friend');

      const ack = await message({ kind: 'acknowledgement' });
      await updateRequest({ $unset: { subject: 1 } });
      await send(ack);
      assert.equal(
        sent[2].subject,
        'We received your message: your message to Trustroots Support',
      );
    });

    it('does not repeat an existing reply prefix but prefixes subjects that merely contain "re:"', async () => {
      const { sent } = transport();
      const subjects = ['Re: Hello', 'RE:Hello', 're:  Hello', 'Care: hello'];
      for (const subject of subjects) {
        await setSubject(subject);
        await sendNew();
      }
      assert.deepEqual(
        sent.map(mail => mail.subject),
        ['Re: Hello', 'RE:Hello', 're:  Hello', 'Re: Care: hello'],
      );
    });

    it('caps overlong stored subjects at 998 characters', async () => {
      const { sent } = transport();
      await SupportRequest.collection.updateOne(
        { _id: requestId },
        { $set: { subject: ` ${'x'.repeat(1200)}` } },
      );
      const reply = await message();
      const ack = await message({ kind: 'acknowledgement' });
      await send(reply);
      await send(ack);
      assert.equal(sent[0].subject, `Re: ${'x'.repeat(998)}`);
      assert.equal(
        sent[1].subject,
        `We received your message: ${'x'.repeat(972)}`,
      );
    });
  });

  describe('outcomes', () => {
    it('captures messages sent through the JSON transport', async () => {
      config.mailer.options = { jsonTransport: true };
      const info = sinon.stub(winston, 'log');
      const bystander = await message({ deliveryState: 'sending' });
      const { doc, after } = await sendNew({ errorCode: 'queue_failed' });
      assert.deepEqual(outcome(after), ['captured', undefined]);
      assert.equal(await stateOf(bystander), 'sending');
      assert.deepEqual(info.args, [
        [
          'info',
          'Support email captured by JSON transport #TV9sJq',
          { messageId: String(doc._id) },
        ],
      ]);
    });

    it('records acceptance, applies request activity and logs it', async () => {
      transport({ accepted: ['one@example.org', 'two@example.org'] });
      const log = sinon.stub(winston, 'log');
      const bystander = await message({ deliveryState: 'sending' });
      const reply = await message({ errorCode: 'queue_failed' });
      await updateRequest({
        $set: { status: 'closed', lastActivityAt: new Date('2025-01-01') },
      });
      await send(reply);
      const accepted = await saved(reply._id);
      assert.deepEqual(outcome(accepted), ['accepted', undefined]);
      assert.ok(accepted.acceptedAt);
      assert.equal(
        accepted.requestActivityAt?.toISOString(),
        '2025-01-01T00:00:00.000Z',
      );
      assert.ok(accepted.activityAppliedAt);
      assert.equal(await stateOf(bystander), 'sending');
      const request = await SupportRequest.findById(requestId).lean();
      assert.equal(request?.status, 'pending');
      assert.equal(request?.statusRevision, 1);
      assert.deepEqual(log.args, [
        [
          'info',
          'Support email accepted by mail transport #Pmx4kC',
          { messageId: String(reply._id), accepted: 2 },
        ],
      ]);
    });

    it('records acceptance for a request that never had activity', async () => {
      transport();
      await updateRequest({ $unset: { lastActivityAt: 1 } });
      const { after } = await sendNew();
      assert.equal(after.deliveryState, 'accepted');
      assert.equal(after.requestActivityAt, null);
    });

    it('fails a message nobody accepted', async () => {
      const bystander = await message({ deliveryState: 'sending' });
      for (const info of [{}, { accepted: [] }] as MailInfo[]) {
        transport(info);
        const { after } = await sendNew();
        assert.deepEqual(outcome(after), ['failed', 'recipient_rejected']);
      }
      assert.equal(await stateOf(bystander), 'sending');
    });

    it('closes the transport after every send, even when closing fails', async () => {
      const closes = { count: 0, fail: true };
      transport(undefined, closes);
      const { after } = await sendNew();
      assert.equal(closes.count, 1);
      assert.equal(after.deliveryState, 'accepted');
    });
  });

  describe('delivery errors', () => {
    it('keeps a sanitised error code and marks transport-rejected mail failed', async () => {
      const log = sinon.stub(winston, 'log');
      failingTransport(rejectedWith({ code: 'EN VELOPE!', responseCode: 550 }));
      const { doc, after } = await sendNew({ errorCode: 'stale' });
      assert.deepEqual(outcome(after), ['failed', 'ENVELOPE']);
      assert.deepEqual(log.args, [
        [
          'error',
          'Support email delivery did not complete #Qe8pLs',
          { messageId: String(doc._id), errorCode: 'ENVELOPE' },
        ],
      ]);
    });

    it('limits error codes to 50 characters', async () => {
      failingTransport(rejectedWith({ code: 'E'.repeat(80) }));
      assert.equal((await sendNew()).after.errorCode, 'E'.repeat(50));
    });

    it('marks the outcome uncertain when the error says nothing about delivery, without touching other messages', async () => {
      const log = sinon.stub(winston, 'log');
      const bystander = await message({ deliveryState: 'sending' });
      failingTransport(new Error('Connection lost'));
      const { doc, after } = await sendNew();
      assert.deepEqual(outcome(after), ['uncertain', undefined]);
      assert.deepEqual((log.args[0] as unknown[])[2], {
        messageId: String(doc._id),
        errorCode: 'uncertain',
      });
      assert.equal(await stateOf(bystander), 'sending');
    });

    it('treats a non-string code as no code', async () => {
      failingTransport(rejectedWith({ code: 42, responseCode: '550' }));
      const { after } = await sendNew();
      assert.deepEqual(outcome(after), ['uncertain', undefined]);
    });

    it('marks only the addressed sending message uncertain when the claim itself errors', async () => {
      const bystander = await message({ deliveryState: 'sending' });
      sinon
        .stub(SupportMessage, 'findOneAndUpdate')
        .rejects(new Error('temporary database failure'));
      assert.equal((await sendNew()).after.deliveryState, 'queued');
      const { after } = await sendNew({ deliveryState: 'sending' });
      assert.equal(after.deliveryState, 'uncertain');
      assert.equal(await stateOf(bystander), 'sending');
    });
  });
});

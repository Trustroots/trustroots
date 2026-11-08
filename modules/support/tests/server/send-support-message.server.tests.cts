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

  async function createRequest(patch: Record<string, unknown> = {}) {
    return SupportRequest.create({
      category: 'other',
      email: 'fictional@example.org',
      message: 'Fictional request',
      status: 'open',
      statusRevision: 0,
      ...patch,
    });
  }

  beforeEach(async () => {
    config.supportInbox.enabled = true;
    config.supportInbox.fromName = 'Fictional Support';
    config.supportInbox.fromAddress = 'support@example.org';
    requestId = (await createRequest())._id;
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
      assert.equal((await saved(queued._id)).deliveryState, 'queued');
    });

    it('fails only the addressed queued message while the inbox is disabled', async () => {
      config.supportInbox.enabled = false;
      const first = await message();
      const target = await message();
      const accepted = await message({ deliveryState: 'accepted' });
      await run({ messageId: String(target._id) });
      await run({ messageId: String(accepted._id) });
      assert.equal((await saved(first._id)).deliveryState, 'queued');
      const failed = await saved(target._id);
      assert.equal(failed.deliveryState, 'failed');
      assert.equal(failed.errorCode, 'inbox_disabled');
      assert.equal((await saved(accepted._id)).deliveryState, 'accepted');
    });

    it('claims only the addressed queued message', async () => {
      transport();
      const first = await message();
      const target = await message();
      await run({ messageId: String(target._id) });
      const untouched = await saved(first._id);
      assert.equal(untouched.deliveryState, 'queued');
      assert.equal(untouched.attempts, 0);
      assert.equal(untouched.lastAttemptAt, undefined);
      const claimed = await saved(target._id);
      assert.equal(claimed.attempts, 1);
      assert.ok(claimed.lastAttemptAt);
    });

    it('leaves a message another worker is already sending alone', async () => {
      const { sent } = transport();
      const sending = await message({ deliveryState: 'sending', attempts: 1 });
      await run({ messageId: String(sending._id) });
      const after = await saved(sending._id);
      assert.equal(after.deliveryState, 'sending');
      assert.equal(after.attempts, 1);
      assert.equal(sent.length, 0);
    });

    it('marks a message failed when the request or recipient is gone', async () => {
      const { sent } = transport();
      const bystander = await message({ deliveryState: 'sending' });
      const noRecipient = await message({ emailTo: undefined });
      const orphan = await message({ request: new mongoose.Types.ObjectId() });
      await run({ messageId: String(noRecipient._id) });
      await run({ messageId: String(orphan._id) });
      for (const target of [noRecipient, orphan]) {
        const failed = await saved(target._id);
        assert.equal(failed.deliveryState, 'failed');
        assert.equal(failed.errorCode, 'recipient_missing');
      }
      assert.equal((await saved(bystander._id)).deliveryState, 'sending');
      assert.equal(sent.length, 0);
    });
  });

  describe('composing the email', () => {
    it('sends a reply from the support address with the message headers', async () => {
      const { sent } = transport();
      await SupportRequest.updateOne(
        { _id: requestId },
        { $set: { subject: 'Hello there' } },
      );
      const reply = await message({
        inReplyTo: '<previous@example.org>',
        references: ['<first@example.org>', '<previous@example.org>'],
      });
      await run({ messageId: String(reply._id) });
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].from, {
        name: 'Fictional Support',
        address: 'support@example.org',
      });
      assert.equal(sent[0].to, 'fictional@example.org');
      assert.equal(sent[0].replyTo, 'support@example.org');
      assert.equal(sent[0].subject, 'Re: Hello there');
      assert.equal(sent[0].text, 'Fictional reply');
      assert.equal(sent[0].messageId, reply.messageId);
      assert.equal(sent[0].inReplyTo, '<previous@example.org>');
      assert.deepEqual(sent[0].references, [
        '<first@example.org>',
        '<previous@example.org>',
      ]);
      assert.deepEqual(sent[0].headers ?? {}, {});
    });

    it('omits threading headers when the message has none', async () => {
      const { sent } = transport();
      const reply = await message();
      await run({ messageId: String(reply._id) });
      assert.equal('inReplyTo' in sent[0], false);
      assert.equal('references' in sent[0], false);
      assert.deepEqual(sent[0].headers ?? {}, {});
    });

    it('marks acknowledgements as automatic replies', async () => {
      const { sent } = transport();
      await SupportRequest.updateOne(
        { _id: requestId },
        { $set: { subject: 'Hello there' } },
      );
      const ack = await message({ kind: 'acknowledgement' });
      await run({ messageId: String(ack._id) });
      assert.equal(sent[0].subject, 'We received your message: Hello there');
      assert.deepEqual(sent[0].headers, {
        'Auto-Submitted': 'auto-replied',
        'X-Auto-Response-Suppress': 'All',
      });
    });

    it('falls back to a default subject and flattens line breaks', async () => {
      const { sent } = transport();
      const plain = await message();
      await run({ messageId: String(plain._id) });
      assert.equal(sent[0].subject, 'Re: your message to Trustroots Support');

      await SupportRequest.updateOne(
        { _id: requestId },
        { $set: { subject: '  Hello\r\nthere\n\nfriend  ' } },
      );
      const multiline = await message();
      await run({ messageId: String(multiline._id) });
      assert.equal(sent[1].subject, 'Re: Hello there friend');

      const ack = await message({ kind: 'acknowledgement' });
      await SupportRequest.updateOne(
        { _id: requestId },
        { $unset: { subject: 1 } },
      );
      await run({ messageId: String(ack._id) });
      assert.equal(
        sent[2].subject,
        'We received your message: your message to Trustroots Support',
      );
    });

    it('does not repeat an existing reply prefix', async () => {
      const { sent } = transport();
      for (const subject of ['Re: Hello', 'RE:Hello', 're:  Hello']) {
        await SupportRequest.updateOne(
          { _id: requestId },
          { $set: { subject } },
        );
        const reply = await message();
        await run({ messageId: String(reply._id) });
      }
      assert.deepEqual(
        sent.map(mail => mail.subject),
        ['Re: Hello', 'RE:Hello', 're:  Hello'],
      );
    });

    it('prefixes subjects that merely contain "re:"', async () => {
      const { sent } = transport();
      await SupportRequest.updateOne(
        { _id: requestId },
        { $set: { subject: 'Care: hello' } },
      );
      const reply = await message();
      await run({ messageId: String(reply._id) });
      assert.equal(sent[0].subject, 'Re: Care: hello');
    });

    it('caps overlong stored subjects at 998 characters', async () => {
      const { sent } = transport();
      await SupportRequest.collection.updateOne(
        { _id: requestId },
        { $set: { subject: ` ${'x'.repeat(1200)}` } },
      );
      const reply = await message();
      const ack = await message({ kind: 'acknowledgement' });
      await run({ messageId: String(reply._id) });
      await run({ messageId: String(ack._id) });
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
      const reply = await message({ errorCode: 'queue_failed' });
      await run({ messageId: String(reply._id) });
      const captured = await saved(reply._id);
      assert.equal(captured.deliveryState, 'captured');
      assert.equal(captured.errorCode, undefined);
      assert.equal((await saved(bystander._id)).deliveryState, 'sending');
      assert.deepEqual(info.args, [
        [
          'info',
          'Support email captured by JSON transport #TV9sJq',
          { messageId: String(reply._id) },
        ],
      ]);
    });

    it('records acceptance, applies request activity and logs it', async () => {
      transport({ accepted: ['one@example.org', 'two@example.org'] });
      const log = sinon.stub(winston, 'log');
      const bystander = await message({ deliveryState: 'sending' });
      const reply = await message({ errorCode: 'queue_failed' });
      await SupportRequest.updateOne(
        { _id: requestId },
        { $set: { status: 'closed', lastActivityAt: new Date('2025-01-01') } },
      );
      await run({ messageId: String(reply._id) });
      const accepted = await saved(reply._id);
      assert.equal(accepted.deliveryState, 'accepted');
      assert.equal(accepted.errorCode, undefined);
      assert.ok(accepted.acceptedAt);
      assert.equal(
        accepted.requestActivityAt?.toISOString(),
        '2025-01-01T00:00:00.000Z',
      );
      assert.ok(accepted.activityAppliedAt);
      assert.equal((await saved(bystander._id)).deliveryState, 'sending');
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
      await SupportRequest.updateOne(
        { _id: requestId },
        { $unset: { lastActivityAt: 1 } },
      );
      const reply = await message();
      await run({ messageId: String(reply._id) });
      const accepted = await saved(reply._id);
      assert.equal(accepted.deliveryState, 'accepted');
      assert.equal(accepted.requestActivityAt, null);
    });

    it('fails a message nobody accepted', async () => {
      const bystander = await message({ deliveryState: 'sending' });
      for (const info of [{}, { accepted: [] }] as MailInfo[]) {
        transport(info);
        const reply = await message();
        await run({ messageId: String(reply._id) });
        const failed = await saved(reply._id);
        assert.equal(failed.deliveryState, 'failed');
        assert.equal(failed.errorCode, 'recipient_rejected');
      }
      assert.equal((await saved(bystander._id)).deliveryState, 'sending');
    });

    it('closes the transport after every send, even when closing fails', async () => {
      const closes = { count: 0, fail: true };
      transport(undefined, closes);
      const reply = await message();
      await run({ messageId: String(reply._id) });
      assert.equal(closes.count, 1);
      assert.equal((await saved(reply._id)).deliveryState, 'accepted');
    });
  });

  describe('delivery errors', () => {
    it('keeps a sanitised error code and marks transport-rejected mail failed', async () => {
      const log = sinon.stub(winston, 'log');
      const reply = await message({ errorCode: 'stale' });
      failingTransport(
        Object.assign(new Error('Rejected'), {
          code: 'EN VELOPE!',
          responseCode: 550,
        }),
      );
      await run({ messageId: String(reply._id) });
      const failed = await saved(reply._id);
      assert.equal(failed.deliveryState, 'failed');
      assert.equal(failed.errorCode, 'ENVELOPE');
      assert.deepEqual(log.args, [
        [
          'error',
          'Support email delivery did not complete #Qe8pLs',
          { messageId: String(reply._id), errorCode: 'ENVELOPE' },
        ],
      ]);
    });

    it('limits error codes to 50 characters', async () => {
      const reply = await message();
      failingTransport(
        Object.assign(new Error('Rejected'), { code: 'E'.repeat(80) }),
      );
      await run({ messageId: String(reply._id) });
      assert.equal((await saved(reply._id)).errorCode, 'E'.repeat(50));
    });

    it('marks the outcome uncertain when the error says nothing about delivery', async () => {
      const log = sinon.stub(winston, 'log');
      const reply = await message();
      failingTransport(new Error('Connection lost'));
      await run({ messageId: String(reply._id) });
      const uncertain = await saved(reply._id);
      assert.equal(uncertain.deliveryState, 'uncertain');
      assert.equal(uncertain.errorCode, undefined);
      assert.deepEqual((log.args[0] as unknown[])[2], {
        messageId: String(reply._id),
        errorCode: 'uncertain',
      });
    });

    it('treats a non-string code as no code', async () => {
      const reply = await message();
      failingTransport(
        Object.assign(new Error('Rejected'), { code: 42, responseCode: '550' }),
      );
      await run({ messageId: String(reply._id) });
      const uncertain = await saved(reply._id);
      assert.equal(uncertain.deliveryState, 'uncertain');
      assert.equal(uncertain.errorCode, undefined);
    });

    it('never touches other messages when claiming fails', async () => {
      const bystander = await message({ deliveryState: 'sending' });
      const reply = await message();
      sinon
        .stub(SupportMessage, 'findOneAndUpdate')
        .rejects(new Error('temporary database failure'));
      await run({ messageId: String(reply._id) });
      assert.equal((await saved(bystander._id)).deliveryState, 'sending');
      assert.equal((await saved(reply._id)).deliveryState, 'queued');
    });

    it('marks the addressed message uncertain when the claim itself errors', async () => {
      const reply = await message({ deliveryState: 'sending' });
      sinon
        .stub(SupportMessage, 'findOneAndUpdate')
        .rejects(new Error('temporary database failure'));
      await run({ messageId: String(reply._id) });
      assert.equal((await saved(reply._id)).deliveryState, 'uncertain');
    });

    it('only updates the claimed message when a later step fails', async () => {
      const bystander = await message({ deliveryState: 'sending' });
      const reply = await message();
      failingTransport(new Error('Connection lost'));
      await run({ messageId: String(reply._id) });
      assert.equal((await saved(bystander._id)).deliveryState, 'sending');
      assert.equal((await saved(reply._id)).deliveryState, 'uncertain');
    });
  });
});

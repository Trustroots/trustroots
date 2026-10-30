const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const emailService: typeof import('../../server/services/support-email.server.service.mts') = require('../../server/services/support-email.server.service.mts');
const mailboxJob: typeof import('../../server/jobs/poll-support-mailbox.server.job.mts') = require('../../server/jobs/poll-support-mailbox.server.job.mts');
const recoveryJob: typeof import('../../server/jobs/recover-support-messages.server.job.mts') = require('../../server/jobs/recover-support-messages.server.job.mts');
const sendJob: typeof import('../../server/jobs/send-support-message.server.job.mts') = require('../../server/jobs/send-support-message.server.job.mts');
const mongoose: typeof import('mongoose') = require('mongoose');
const MongoClient: typeof import('mongodb').MongoClient =
  require('mongodb').MongoClient;
const agenda: typeof import('../../../../config/lib/agenda.mjs').default = require('../../../../config/lib/agenda.mjs');
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

const SupportRequest = mongoose.model('SupportRequest');
const SupportMessage = mongoose.model('SupportMessage');
const originalMailerOptions = config.mailer.options;
type StoredSupportMessage =
  import('../../server/models/support-message.server.model.mts').SupportMessageRecord & {
    _id: import('mongoose').Types.ObjectId;
  };
type StubbedAgendaJob = {
  unique: (
    query: Record<string, unknown>,
    options: { insertOnly: boolean },
  ) => StubbedAgendaJob;
  save: () => Promise<void>;
};
type StubbedAgenda = {
  create: (name: string, data: Record<string, unknown>) => StubbedAgendaJob;
};

function stubSupportJobs() {
  const jobs: Array<{ name: string; data: Record<string, unknown> }> = [];
  const agendaTestDouble = agenda as unknown as StubbedAgenda;
  sinon.stub(agendaTestDouble, 'create').callsFake((name, data) => ({
    unique() {
      return this;
    },
    save: async () => {
      jobs.push({ name, data });
    },
  }));
  return jobs;
}

describe('Support email service', () => {
  afterEach(() => {
    sinon.restore();
    config.supportInbox.enabled = false;
    config.mailer.options = originalMailerOptions;
  });

  afterEach(utils.clearDatabase);

  it('rejects replies while the support inbox is disabled', async () => {
    config.supportInbox.enabled = false;
    await assert.rejects(
      emailService.queueReply(
        '000000000000000000000000',
        { _id: '000000000000000000000000' },
        'A reply',
        'key',
      ),
      (error: unknown) =>
        error instanceof emailService.SupportEmailError &&
        error.code === 'disabled' &&
        error.status === 503,
    );
  });

  it('rejects blank reply bodies before accessing a request', async () => {
    config.supportInbox.enabled = true;
    await assert.rejects(
      emailService.queueReply(
        '000000000000000000000000',
        { _id: '000000000000000000000000' },
        '  \r\n ',
        'reply-key',
      ),
      (error: unknown) =>
        error instanceof emailService.SupportEmailError &&
        error.code === 'invalid' &&
        error.status === 400,
    );
  });

  it('rejects unbounded idempotency keys before accessing a request', async () => {
    config.supportInbox.enabled = true;
    await assert.rejects(
      emailService.queueReply(
        '000000000000000000000000',
        { _id: '000000000000000000000000' },
        'A reply',
        'x'.repeat(201),
      ),
      (error: unknown) =>
        error instanceof emailService.SupportEmailError && error.status === 400,
    );
  });

  it('does not connect to IMAP while the support inbox is disabled', async () => {
    config.supportInbox.enabled = false;
    await new Promise<void>((resolve, reject) => {
      mailboxJob.pollSupportMailbox({ attrs: {} } as never, error => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it('does not recover or enqueue mail while the support inbox is disabled', async () => {
    config.supportInbox.enabled = false;
    await new Promise<void>((resolve, reject) => {
      recoveryJob.recoverSupportMessages({ attrs: {} } as never, error => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it('ignores missing or already claimed send jobs', async () => {
    config.supportInbox.enabled = true;
    const run = (messageId?: string) =>
      new Promise<void>((resolve, reject) => {
        sendJob.sendSupportMessage(
          { attrs: { data: messageId ? { messageId } : undefined } } as never,
          error => (error ? reject(error) : resolve()),
        );
      });
    await run();
    await run('000000000000000000000000');
  });

  it('handles a database claim failure without losing the queued message', async () => {
    config.supportInbox.enabled = true;
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: request.email,
      messageId: '<fixture-claim-error@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 0,
    });
    sinon
      .stub(SupportMessage, 'findOneAndUpdate')
      .rejects(new Error('temporary database failure'));
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(message._id).lean()) as {
      deliveryState: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'queued');
  });

  it('marks queued messages failed if the inbox is disabled before sending', async () => {
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: request.email,
      messageId: '<fixture-disabled@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 0,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'failed');
    assert.equal(saved.errorCode, 'inbox_disabled');
  });

  it('marks a claimed send failed when its request no longer exists', async () => {
    config.supportInbox.enabled = true;
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: request.email,
      messageId: '<fixture-missing-request@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 0,
    });
    await SupportRequest.deleteOne({ _id: request._id });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(message._id).lean()) as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'failed');
    assert.equal(saved.errorCode, 'recipient_missing');
  });

  it('marks a claimed send failed when the recipient snapshot is missing', async () => {
    config.supportInbox.enabled = true;
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: '',
      messageId: '<fixture-missing-recipient@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 0,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(message._id).lean()) as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'failed');
    assert.equal(saved.errorCode, 'recipient_missing');
  });

  it('queues one reply per idempotency key and rejects a conflicting reuse', async () => {
    config.supportInbox.enabled = true;
    const jobs = stubSupportJobs();
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });
    const actor = {
      _id: new mongoose.Types.ObjectId(),
      displayName: 'Support helper',
    };
    const first = await emailService.queueReply(
      String(request._id),
      actor,
      'A reply for the requester',
      'request-reply-1',
    );
    const repeated = await emailService.queueReply(
      String(request._id),
      actor,
      'A reply for the requester',
      'request-reply-1',
    );
    assert.equal(String(first._id), String(repeated._id));
    assert.equal(jobs.length, 1);
    await assert.rejects(
      emailService.queueReply(
        String(request._id),
        actor,
        'A different reply',
        'request-reply-1',
      ),
      (error: unknown) =>
        error instanceof emailService.SupportEmailError && error.status === 409,
    );
  });

  it('uses a stable acknowledgement key and queues only once', async () => {
    config.supportInbox.enabled = true;
    const jobs = stubSupportJobs();
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });
    const first = await emailService.queueAcknowledgement(String(request._id));
    const repeated = await emailService.queueAcknowledgement(
      String(request._id),
    );
    assert.equal(String(first._id), String(repeated._id));
    assert.equal(first.idempotencyKey, `ack:${request._id}`);
    assert.equal(jobs.length, 1);
  });

  it('leaves failed acknowledgement scheduling queued for recovery without duplicating it', async () => {
    config.supportInbox.enabled = true;
    const schedule = sinon.stub(agenda, 'create').callsFake(
      () =>
        ({
          save: async () => {
            throw new Error('Queue unavailable');
          },
        }) as never,
    );
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });

    await assert.rejects(
      emailService.queueAcknowledgement(String(request._id)),
      /Queue unavailable/,
    );
    const first = await SupportMessage.findOne({
      request: request._id,
      kind: 'acknowledgement',
    }).lean<StoredSupportMessage>();
    assert.ok(first);
    assert.equal(first.deliveryState, 'queued');
    assert.equal(first.errorCode, 'queue_failed');
    assert.equal(first.idempotencyKey, `ack:${request._id}`);
    assert.equal(schedule.callCount, 1);

    const repeated = await emailService.queueAcknowledgement(
      String(request._id),
    );
    assert.equal(String(repeated._id), String(first._id));
    assert.equal(repeated.messageId, first.messageId);
    assert.equal(schedule.callCount, 1);
    assert.equal(
      await SupportMessage.countDocuments({
        request: request._id,
        kind: 'acknowledgement',
      }),
      1,
    );
  });

  it('records JSON transport output as captured without changing request status', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = { jsonTransport: true };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'new',
      statusRevision: 0,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-1@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 0,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as { deliveryState: string; attempts: number } | null;
    const savedRequest = (await SupportRequest.findById(
      request._id,
    ).lean()) as unknown as { status: string } | null;
    assert.ok(saved);
    assert.ok(savedRequest);
    assert.equal(saved.deliveryState, 'captured');
    assert.equal(savedRequest.status, 'new');
    assert.equal(saved.attempts, 1);
  });

  it('marks acknowledgements as automated email and keeps the new status', async () => {
    config.supportInbox.enabled = true;
    let sentMail:
      | { data?: { headers?: Record<string, string>; subject?: string } }
      | undefined;
    config.mailer.options = {
      send: (
        mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => {
        sentMail = mail as typeof sentMail;
        callback(null, { accepted: ['anonymous@example.org'] });
      },
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      subject: 'Support request [Other]',
      status: 'new',
      statusRevision: 0,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'acknowledgement',
      body: 'We have received your message.',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-ack@example.org>',
      idempotencyKey: `ack:${request._id}`,
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 0,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    assert.equal(
      sentMail?.data?.subject,
      'We received your message: Support request [Other]',
    );
    assert.equal(sentMail?.data?.headers?.['Auto-Submitted'], 'auto-replied');
    assert.equal(sentMail?.data?.headers?.['X-Auto-Response-Suppress'], 'All');
    const savedRequest = (await SupportRequest.findById(
      request._id,
    ).lean()) as unknown as { status: string } | null;
    assert.ok(savedRequest);
    assert.equal(savedRequest.status, 'new');
  });

  it('marks accepted replies pending only when the queued request revision is unchanged', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => callback(null, { accepted: ['anonymous@example.org'] }),
    };
    const sent = new Date('2024-02-01T00:00:00.000Z');
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      subject: 'Re: Support request [Other]',
      status: 'open',
      statusRevision: 3,
      lastActivityAt: sent,
      resolvedAt: sent,
      resolvedBy: new mongoose.Types.ObjectId(),
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-2@example.org>',
      inReplyTo: '<fixture-initial@example.org>',
      references: ['<fixture-initial@example.org>'],
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 3,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const savedMessage = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as { deliveryState: string } | null;
    const savedRequest = (await SupportRequest.findById(
      request._id,
    ).lean()) as unknown as {
      status: string;
      statusRevision: number;
      resolvedAt: Date | null;
      resolvedBy: import('mongoose').Types.ObjectId | null;
    } | null;
    assert.ok(savedMessage);
    assert.ok(savedRequest);
    assert.equal(savedMessage.deliveryState, 'accepted');
    assert.equal(savedRequest.status, 'pending');
    assert.equal(savedRequest.statusRevision, 4);
    assert.equal(savedRequest.resolvedAt, null);
    assert.equal(savedRequest.resolvedBy, null);
  });

  it('does not overwrite request activity that changed while SMTP was sending', async () => {
    config.supportInbox.enabled = true;
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 3,
    });
    config.mailer.options = {
      send: async (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => {
        await SupportRequest.updateOne(
          { _id: request._id },
          { $set: { status: 'resolved' }, $inc: { statusRevision: 1 } },
        );
        callback(null, { accepted: ['anonymous@example.org'] });
      },
    };
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: request.email,
      messageId: '<fixture-stale-activity@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 3,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const savedMessage = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as { deliveryState: string } | null;
    const savedRequest = (await SupportRequest.findById(
      request._id,
    ).lean()) as unknown as { status: string; statusRevision: number } | null;
    assert.ok(savedMessage);
    assert.ok(savedRequest);
    assert.equal(savedMessage.deliveryState, 'accepted');
    assert.equal(savedRequest.status, 'resolved');
    assert.equal(savedRequest.statusRevision, 4);
  });

  it('marks an indeterminate SMTP outcome uncertain without retrying it', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => {
        const error = Object.assign(new Error('transport unavailable'), {
          code: 'ECONNECTION',
        });
        callback(error);
      },
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 1,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-3@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 1,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'uncertain');
    assert.equal(saved.errorCode, 'ECONNECTION');
  });

  it('records an uncertain SMTP error without exposing its message or inventing a code', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => callback(new Error('private transport detail')),
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 1,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: request.email,
      messageId: '<fixture-no-code@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 1,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(message._id).lean()) as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'uncertain');
    assert.equal(saved.errorCode, undefined);
  });

  it('marks a definite SMTP refusal failed so it can be retried safely', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => {
        const error = Object.assign(new Error('recipient refused'), {
          code: 'EENVELOPE',
          responseCode: 550,
        });
        callback(error);
      },
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 1,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-7@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 1,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'failed');
    assert.equal(saved.errorCode, 'EENVELOPE');
  });

  it('marks an all-recipient refusal failed when the transport resolves without accepted recipients', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => callback(null, { accepted: [] }),
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 1,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-empty-accepted@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 1,
    });
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const saved = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'failed');
    assert.equal(saved.errorCode, 'recipient_rejected');
  });

  it('requires confirmation to retry uncertain delivery and deduplicates the retry key', async () => {
    config.supportInbox.enabled = true;
    const jobs = stubSupportJobs();
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 1,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-4@example.org>',
      idempotencyKey: 'original-key',
      idempotencyKeys: ['original-key'],
      deliveryState: 'uncertain',
      attempts: 1,
      requestRevision: 1,
    });
    await assert.rejects(
      emailService.retryReply(
        String(request._id),
        String(message._id),
        { _id: new mongoose.Types.ObjectId() },
        'retry-key',
        false,
      ),
      (error: unknown) =>
        error instanceof emailService.SupportEmailError &&
        error.code === 'uncertain',
    );
    const retried = await emailService.retryReply(
      String(request._id),
      String(message._id),
      { _id: new mongoose.Types.ObjectId() },
      'retry-key',
      true,
    );
    const repeated = await emailService.retryReply(
      String(request._id),
      String(message._id),
      { _id: new mongoose.Types.ObjectId() },
      'retry-key',
      false,
    );
    const repeatedOriginalPost = await emailService.queueReply(
      String(request._id),
      { _id: new mongoose.Types.ObjectId() },
      'A reply',
      'original-key',
    );
    assert.equal(retried.deliveryState, 'queued');
    assert.equal(String(retried._id), String(repeated._id));
    assert.equal(String(retried._id), String(repeatedOriginalPost._id));
    assert.equal(jobs.length, 1);
  });

  it('starts an explicit retry from the request activity current at retry time', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => callback(null, { accepted: ['anonymous@example.org'] }),
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 3,
      lastActivityAt: new Date('2024-05-01T00:00:00.000Z'),
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailFrom: config.supportInbox.fromAddress,
      emailTo: request.email,
      messageId: '<fixture-retry-activity@example.org>',
      idempotencyKey: 'retry-original',
      idempotencyKeys: ['retry-original'],
      deliveryState: 'failed',
      attempts: 1,
      requestRevision: 2,
      requestActivityAt: new Date('2024-04-30T00:00:00.000Z'),
      acceptedAt: new Date('2024-04-30T00:00:01.000Z'),
      activityAppliedAt: new Date('2024-04-30T00:00:01.000Z'),
    });
    const retried = await emailService.retryReply(
      String(request._id),
      String(message._id),
      { _id: new mongoose.Types.ObjectId() },
      'retry-activity-key',
      false,
    );
    assert.equal(retried.deliveryState, 'queued');
    assert.equal(retried.requestRevision, 3);
    assert.equal(
      retried.requestActivityAt?.toISOString(),
      '2024-05-01T00:00:00.000Z',
    );
    assert.equal(retried.acceptedAt, undefined);
    assert.equal(retried.activityAppliedAt, undefined);
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    const acceptedAgain = (await SupportMessage.findById(
      message._id,
    ).lean()) as unknown as {
      deliveryState: string;
      idempotencyKeys: string[];
      activityAppliedAt?: Date;
      requestRevision: number;
    } | null;
    const updatedRequest = (await SupportRequest.findById(
      request._id,
    ).lean()) as unknown as { status: string; statusRevision: number } | null;
    assert.ok(acceptedAgain);
    assert.ok(updatedRequest);
    assert.equal(acceptedAgain.deliveryState, 'accepted');
    assert.deepEqual(acceptedAgain.idempotencyKeys, [
      'retry-original',
      'retry-activity-key',
    ]);
    assert.ok(acceptedAgain.activityAppliedAt);
    assert.equal(acceptedAgain.requestRevision, 4);
    assert.equal(updatedRequest.status, 'pending');
    assert.equal(updatedRequest.statusRevision, 4);
  });

  it('recovers accepted email activity after a request write fails without resending', async () => {
    config.supportInbox.enabled = true;
    let sendCount = 0;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => {
        sendCount += 1;
        callback(null, { accepted: ['anonymous@example.org'] });
      },
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 5,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: request.email,
      messageId: '<fixture-recover-activity@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 5,
    });
    const updateStub = sinon
      .stub(SupportRequest, 'updateOne')
      .rejects(new Error('temporary request write failure'));
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    updateStub.restore();
    const accepted = (await SupportMessage.findById(message._id).lean()) as {
      deliveryState: string;
      acceptedAt: Date;
      activityAppliedAt?: Date;
      requestRevision: number;
    } | null;
    assert.ok(accepted);
    assert.equal(accepted.deliveryState, 'accepted');
    assert.equal(accepted.activityAppliedAt, undefined);
    assert.equal(accepted.requestRevision, 5);

    await new Promise<void>((resolve, reject) => {
      recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
        error ? reject(error) : resolve(),
      );
    });
    const recovered = (await SupportMessage.findById(message._id).lean()) as {
      activityAppliedAt?: Date;
      requestRevision: number;
    } | null;
    const recoveredRequest = (await SupportRequest.findById(
      request._id,
    ).lean()) as unknown as {
      status: string;
      statusRevision: number;
      lastActivityAt: Date;
    } | null;
    assert.ok(recovered);
    assert.ok(recoveredRequest);
    assert.ok(recovered.activityAppliedAt);
    assert.equal(recovered.requestRevision, 6);
    assert.equal(recoveredRequest.status, 'pending');
    assert.equal(recoveredRequest.statusRevision, 6);
    assert.equal(
      recoveredRequest.lastActivityAt.toISOString(),
      accepted.acceptedAt.toISOString(),
    );

    await new Promise<void>((resolve, reject) => {
      recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
        error ? reject(error) : resolve(),
      );
    });
    const repeated = (await SupportRequest.findById(
      request._id,
    ).lean()) as unknown as { statusRevision: number } | null;
    assert.ok(repeated);
    assert.equal(repeated.statusRevision, 6);
    assert.equal(sendCount, 1);
  });

  it('recognises an accepted request write whose acknowledgement was lost', async () => {
    config.supportInbox.enabled = true;
    config.mailer.options = {
      send: (
        _mail: unknown,
        callback: (error?: Error | null, info?: unknown) => void,
      ) => callback(null, { accepted: ['anonymous@example.org'] }),
    };
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 7,
    });
    const message = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A reply',
      emailTo: request.email,
      messageId: '<fixture-lost-ack@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      requestRevision: 7,
    });
    const actualUpdate = SupportRequest.updateOne.bind(SupportRequest);
    const updateStub = sinon
      .stub(SupportRequest, 'updateOne')
      .callsFake((async (
        ...args: Parameters<typeof SupportRequest.updateOne>
      ) => {
        await actualUpdate(...args);
        throw new Error('request write acknowledgement lost');
      }) as never);
    await new Promise<void>((resolve, reject) => {
      sendJob.sendSupportMessage(
        { attrs: { data: { messageId: String(message._id) } } } as never,
        error => (error ? reject(error) : resolve()),
      );
    });
    updateStub.restore();
    const first = (await SupportRequest.findById(request._id).lean()) as {
      statusRevision: number;
      lastActivityAt: Date;
    } | null;
    assert.ok(first);
    assert.equal(first.statusRevision, 8);

    await new Promise<void>((resolve, reject) => {
      recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
        error ? reject(error) : resolve(),
      );
    });
    const recovered = (await SupportMessage.findById(message._id).lean()) as {
      activityAppliedAt?: Date;
      requestRevision: number;
    } | null;
    const after = (await SupportRequest.findById(request._id).lean()) as {
      statusRevision: number;
    } | null;
    assert.ok(recovered);
    assert.ok(after);
    assert.ok(recovered.activityAppliedAt);
    assert.equal(recovered.requestRevision, 8);
    assert.equal(after.statusRevision, 8);
  });

  it('recovers stale sends to uncertain and re-enqueues old queued messages', async () => {
    config.supportInbox.enabled = true;
    const jobs = stubSupportJobs();
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 1,
    });
    const stale = new Date(Date.now() - 15 * 60 * 1000);
    const sending = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'An interrupted send',
      messageId: '<fixture-5@example.org>',
      deliveryState: 'sending',
      attempts: 1,
      lastAttemptAt: stale,
      createdAt: stale,
      requestRevision: 1,
    });
    const queued = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A queued send',
      messageId: '<fixture-6@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      createdAt: stale,
      requestRevision: 1,
    });
    await new Promise<void>((resolve, reject) => {
      recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
        error ? reject(error) : resolve(),
      );
    });
    const saved = (await SupportMessage.findById(
      sending._id,
    ).lean()) as unknown as {
      deliveryState: string;
      errorCode?: string;
    } | null;
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'uncertain');
    assert.equal(saved.errorCode, 'worker_interrupted');
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].data.messageId, String(queued._id));
  });

  for (const legacyFailure of [false, true]) {
    it(`recovers ${legacyFailure ? 'legacy failed' : 'queued'} acknowledgements and bounds Agenda duplicates`, async () => {
      config.supportInbox.enabled = true;
      const request = await SupportRequest.create({
        category: 'other',
        email: 'anonymous@example.org',
        message: 'A fictional request',
        status: 'new',
        statusRevision: 0,
      });
      const createStub = sinon.stub(agenda, 'create').callsFake((() => ({
        save: async () => {
          throw new Error('fixture queue failure');
        },
      })) as never);
      await assert.rejects(
        emailService.queueAcknowledgement(String(request._id)),
      );
      createStub.restore();

      const acknowledgement = await SupportMessage.findOne({
        request: request._id,
        kind: 'acknowledgement',
      });
      assert.ok(acknowledgement);
      assert.equal(acknowledgement.deliveryState, 'queued');
      assert.equal(acknowledgement.errorCode, 'queue_failed');
      await SupportMessage.updateOne(
        { _id: acknowledgement._id },
        {
          $set: {
            createdAt: new Date(Date.now() - 2 * 60 * 1000),
            ...(legacyFailure && { deliveryState: 'failed' }),
          },
        },
      );

      const messageId = String(acknowledgement._id);
      const query = {
        name: 'send support message',
        data: { messageId },
      };
      try {
        await new Promise<void>((resolve, reject) => {
          recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
            error ? reject(error) : resolve(),
          );
        });
        await new Promise<void>((resolve, reject) => {
          recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
            error ? reject(error) : resolve(),
          );
        });
        const mongoClient = await MongoClient.connect(config.db.uri);
        try {
          const acknowledgementJobs = await mongoClient
            .db()
            .collection('agendaJobs')
            .find(query)
            .toArray();
          assert.equal(
            acknowledgementJobs.filter(job => !job.lastFinishedAt).length,
            1,
          );
        } finally {
          await mongoClient.close();
        }
        const recovered = await SupportMessage.findById(
          acknowledgement._id,
        ).lean<StoredSupportMessage>();
        assert.equal(recovered?.deliveryState, 'queued');
        assert.equal(
          recovered?.errorCode,
          legacyFailure ? undefined : 'queue_failed',
        );
      } finally {
        await agenda.cancel({
          name: 'send support message',
          data: { messageId },
        });
      }
    });
  }

  it('allows recovery when only a completed historical Agenda job exists', async () => {
    config.supportInbox.enabled = true;
    const request = await SupportRequest.create({
      category: 'other',
      email: 'anonymous@example.org',
      message: 'A fictional request',
      status: 'open',
      statusRevision: 0,
    });
    const queued = await SupportMessage.create({
      request: request._id,
      direction: 'outbound',
      kind: 'reply',
      body: 'A queued reply',
      messageId: '<fixture-historical-job@example.org>',
      deliveryState: 'queued',
      attempts: 0,
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    });
    const messageId = String(queued._id);
    const name = 'send support message';
    try {
      await agenda.create(name, { messageId }).save();
      const { jobs: historicalJobs } = await agenda.queryJobs({
        name,
        data: { messageId },
      });
      const [historical] = historicalJobs;
      assert.ok(historical);
      const historicalClient = await MongoClient.connect(config.db.uri);
      try {
        await historicalClient
          .db()
          .collection('agendaJobs')
          .updateOne(
            { name, 'data.messageId': messageId },
            { $set: { lastFinishedAt: new Date(), nextRunAt: null } },
          );
      } finally {
        await historicalClient.close();
      }

      await new Promise<void>((resolve, reject) => {
        recoveryJob.recoverSupportMessages({ attrs: {} } as never, error =>
          error ? reject(error) : resolve(),
        );
      });
      const recoveryClient = await MongoClient.connect(config.db.uri);
      let jobs: Array<{ lastFinishedAt?: Date | null }> = [];
      try {
        jobs = await recoveryClient
          .db()
          .collection<{ lastFinishedAt?: Date | null }>('agendaJobs')
          .find({ name, 'data.messageId': messageId })
          .toArray();
      } finally {
        await recoveryClient.close();
      }
      assert.equal(jobs.length, 2);
      assert.equal(jobs.filter(job => !job.lastFinishedAt).length, 1);
    } finally {
      await agenda.cancel({ name, data: { messageId } });
    }
  });

  it('reports queue recovery database errors through the job callback', async () => {
    config.supportInbox.enabled = true;
    sinon
      .stub(SupportMessage, 'updateMany')
      .rejects(new Error('fixture error'));
    await new Promise<void>(resolve => {
      recoveryJob.recoverSupportMessages({ attrs: {} } as never, error => {
        assert.ok(error);
        resolve();
      });
    });
  });
});

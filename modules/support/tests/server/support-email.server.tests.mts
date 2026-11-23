import config from '../../../../config/config.mts';
import assert from 'node:assert/strict';
import * as emailService from '../../server/services/support-email.server.service.mts';
import { SupportEmailError } from '../../server/services/support-email.server.service.mts';
import * as mailboxJob from '../../server/jobs/poll-support-mailbox.server.job.mts';
import * as recoveryJob from '../../server/jobs/recover-support-messages.server.job.mts';
import * as sendJob from '../../server/jobs/send-support-message.server.job.mts';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import agenda from '../../../../config/lib/agenda.mts';
import sinon from 'sinon';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';

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
        error instanceof SupportEmailError &&
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
        error instanceof SupportEmailError &&
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
        error instanceof SupportEmailError && error.status === 400,
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
        error instanceof SupportEmailError && error.status === 409,
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
        error instanceof SupportEmailError && error.code === 'uncertain',
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

describe('Support email service behaviour', () => {
  interface SupportMessageFields {
    deliveryState?: string;
    errorCode?: string;
    acceptedAt?: Date;
    requestActivityAt?: Date;
    activityAppliedAt?: Date;
    requestRevision?: number;
    idempotencyKeys?: string[];
    [field: string]: unknown;
  }
  type ObjectId = import('mongoose').Types.ObjectId;
  const SupportMessage = mongoose.model<SupportMessageFields>('SupportMessage');
  const originalInbox = { ...config.supportInbox };
  const actor = {
    _id: new mongoose.Types.ObjectId(),
    displayName: 'Fictional helper',
  };
  const ACK_TEXT =
    'We have received your message. A member of our team will reply as soon as possible.';

  let sequence = 0;

  type Rejection = { code: string; status: number; message: string };
  const err = (code: string, status: number, message: string): Rejection => ({
    code,
    status,
    message,
  });
  const DISABLED = err('disabled', 503, 'Support inbox is disabled');
  const KEY_REQUIRED = err('invalid', 400, 'An idempotency key is required');
  const KEY_TOO_LONG = err('invalid', 400, 'Idempotency key is too long');
  const KEY_USED = err('conflict', 409, 'Idempotency key was already used');
  const NO_REPLY = err('not-found', 404, 'Support reply not found');
  const NO_REQUEST = err('not-found', 404, 'Support request not found');
  const UNCERTAIN = err(
    'uncertain',
    409,
    'Confirm retry of uncertain delivery',
  );
  const NOT_RETRYABLE = err(
    'conflict',
    409,
    'Reply cannot be retried in its current state',
  );
  const CHANGED = err('conflict', 409, 'Reply changed while retry was queued');
  const outcome = (message: SupportMessageFields | null) => [
    message?.deliveryState,
    message?.errorCode,
  ];
  const IN_PROGRESS = ['queued', 'sending', 'accepted', 'captured'];

  async function rejects(promise: Promise<unknown>, expected: Rejection) {
    try {
      await promise;
    } catch (error) {
      assert.ok(error instanceof SupportEmailError, String(error));
      assert.equal(error.name, 'SupportEmailError');
      assert.deepEqual(
        { code: error.code, status: error.status, message: error.message },
        expected,
      );
      return;
    }
    throw new assert.AssertionError({ message: 'Expected a rejection' });
  }

  const duplicateError = () =>
    Object.assign(new Error('duplicate'), { code: 11000 });

  /** Makes the first SupportMessage.findOne miss, then behave normally. */
  function missFirstFindOne() {
    const real = SupportMessage.findOne.bind(SupportMessage);
    sinon
      .stub(SupportMessage, 'findOne')
      .onFirstCall()
      .returns({ lean: async () => null } as never)
      .callsFake(real as never);
  }

  let requestId: string;
  let calls: Array<{ name: string; data: Record<string, unknown> }>;
  let queueFailure: Error | undefined;

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

  async function createMessage(patch: Record<string, unknown> = {}) {
    return SupportMessage.create({
      request: requestId,
      direction: 'outbound',
      kind: 'reply',
      body: 'Fictional reply',
      emailTo: 'fictional@example.org',
      messageId: `<fictional-behaviour-${++sequence}@example.org>`,
      deliveryState: 'queued',
      attempts: 0,
      ...patch,
    });
  }

  async function state(id: ObjectId) {
    const found = await SupportMessage.findById(id).lean();
    assert.ok(found);
    return found;
  }

  const reply = (body: unknown = 'Hi', key: unknown = 'k', id = requestId) =>
    emailService.queueReply(id, actor, body, key);

  const setRequest = (set: Record<string, unknown>) =>
    SupportRequest.updateOne({ _id: requestId }, set);

  beforeEach(async () => {
    config.supportInbox.enabled = true;
    config.supportInbox.fromAddress = 'support@example.org';
    requestId = String((await createRequest())._id);
    calls = [];
    queueFailure = undefined;
    sinon.stub(agenda, 'create').callsFake(((
      name: string,
      data: Record<string, unknown>,
    ) => ({
      save: async () => {
        calls.push({ name, data });
        if (queueFailure) throw queueFailure;
      },
    })) as never);
  });

  afterEach(async () => {
    sinon.restore();
    Object.assign(config.supportInbox, originalInbox);
    await utils.clearDatabase();
  });

  describe('queueing a reply', () => {
    it('reports a disabled inbox or an unusable sender address', async () => {
      config.supportInbox.enabled = false;
      await rejects(reply(), DISABLED);
      config.supportInbox.enabled = true;
      config.supportInbox.fromAddress = 'not-an-address';
      await rejects(
        reply(),
        err('disabled', 503, 'Support sender address is not configured'),
      );
    });

    it('rejects bodies that are not text, empty or too long', async () => {
      for (const body of [undefined, null, 5, {}]) {
        await rejects(
          emailService.queueReply(requestId, actor, body, 'k'),
          err('invalid', 400, 'Reply body must be text'),
        );
      }
      for (const body of ['', ' \r\n\t ', 'x'.repeat(20001)]) {
        await rejects(
          reply(body),
          err('invalid', 400, 'Reply body length is invalid'),
        );
      }
      assert.equal((await reply('x'.repeat(20000))).body.length, 20000);
    });

    it('normalises line endings and surrounding whitespace in the stored body', async () => {
      const queued = await reply('  one\r\ntwo\rthree  ');
      assert.equal(queued.body, 'one\ntwo\nthree');
    });

    it('requires a trimmed idempotency key of at most 200 characters', async () => {
      for (const key of [undefined, 5, '', '   ']) {
        await rejects(
          emailService.queueReply(requestId, actor, 'Hi', key),
          KEY_REQUIRED,
        );
      }
      await rejects(reply('Hi', 'k'.repeat(201)), KEY_TOO_LONG);
      const queued = await reply('Hi', ` ${'k'.repeat(200)} `);
      assert.equal(queued.idempotencyKey, 'k'.repeat(200));
      assert.deepEqual(queued.idempotencyKeys, ['k'.repeat(200)]);
    });

    it('requires an existing request with a valid email address', async () => {
      await rejects(
        reply('Hi', 'k', String(new mongoose.Types.ObjectId())),
        NO_REQUEST,
      );
      const bad = await createRequest({ email: 'nobody' });
      const none = await createRequest();
      await SupportRequest.updateOne(
        { _id: none._id },
        { $unset: { email: 1 } },
      );
      for (const id of [bad._id, none._id]) {
        await rejects(
          reply('Hi', 'k', String(id)),
          err('invalid', 400, 'Request has no valid email address'),
        );
      }
    });

    it('returns the earlier reply for a repeated key and rejects a different payload', async () => {
      const first = await reply();
      const create = sinon.spy(SupportMessage, 'create');
      const repeated = await reply();
      assert.equal(String(repeated._id), String(first._id));
      assert.equal(calls.length, 1);
      assert.equal(create.callCount, 0);
      await rejects(reply('Other'), KEY_USED);
      const ack = await emailService.queueAcknowledgement(requestId);
      assert.equal(ack.kind, 'acknowledgement');
      await rejects(reply(ACK_TEXT, `ack:${requestId}`), KEY_USED);
      assert.equal(await SupportMessage.countDocuments(), 2);
    });

    it('queues the send job for the stored message on a new thread', async () => {
      const queued = await reply();
      assert.deepEqual(calls, [
        {
          name: 'send support message',
          data: { messageId: String(queued._id) },
        },
      ]);
      assert.equal(queued.deliveryState, 'queued');
      assert.equal(String(queued.authorId), String(actor._id));
      assert.equal(queued.authorName, 'Fictional helper');
      // A request without earlier messages starts a new thread.
      assert.deepEqual(queued.references, []);
      assert.equal(queued.inReplyTo, undefined);
    });

    it('uses a message id on the sender domain', async () => {
      config.supportInbox.fromAddress = '"a@b"@sender.example.org';
      const queued = await reply();
      assert.match(queued.messageId, /^<[\da-f-]{36}@sender\.example\.org>$/);
    });

    it('threads onto the request and the most recent message', async () => {
      await setRequest({
        $set: { initialMessageId: '<initial@example.org>', statusRevision: 4 },
      });
      const t = (day: number) => new Date(Date.UTC(2025, 0, day));
      const other = await createRequest();
      for (const [day, name] of [
        [1, 'oldest'],
        [9, 'newest'],
        [5, 'middle'],
      ] as const) {
        await createMessage({
          createdAt: t(day),
          messageId: `<${name}@example.org>`,
        });
      }
      await createMessage({
        request: other._id,
        createdAt: t(20),
        messageId: '<elsewhere@example.org>',
      });
      const queued = await reply();
      assert.equal(queued.inReplyTo, '<newest@example.org>');
      assert.deepEqual(queued.references, [
        '<initial@example.org>',
        '<newest@example.org>',
      ]);
      assert.equal(queued.requestRevision, 4);
      assert.equal(queued.emailFrom, 'support@example.org');
      assert.equal(queued.emailTo, 'fictional@example.org');
    });

    it('breaks creation time ties by the later message', async () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      await createMessage({ createdAt, messageId: '<first@example.org>' });
      await createMessage({ createdAt, messageId: '<second@example.org>' });
      assert.equal((await reply()).inReplyTo, '<second@example.org>');
    });

    it('does not repeat the request message id in the references', async () => {
      await setRequest({ $set: { initialMessageId: '<initial@example.org>' } });
      const queued = await reply();
      assert.equal(queued.inReplyTo, '<initial@example.org>');
      assert.deepEqual(queued.references, ['<initial@example.org>']);
      await SupportMessage.deleteOne({ _id: queued._id });
      await createMessage({ messageId: '<initial@example.org>' });
      const again = await reply('Hi', 'k2');
      assert.deepEqual(again.references, ['<initial@example.org>']);
    });

    it('marks a reply failed, but keeps an acknowledgement queued, when the send job cannot be queued', async () => {
      const bystander = await createMessage();
      queueFailure = new Error('Queue down');
      await assert.rejects(reply(), /Queue down/);
      assert.equal((await state(bystander._id)).deliveryState, 'queued');
      const failed = await SupportMessage.findOne({ idempotencyKey: 'k' });
      assert.deepEqual(outcome(failed), ['failed', 'queue_failed']);
      // An acknowledgement stays queued for the recovery job instead.
      await assert.rejects(emailService.queueAcknowledgement(requestId));
      const ack = await SupportMessage.findOne({ kind: 'acknowledgement' });
      assert.deepEqual(outcome(ack), ['queued', 'queue_failed']);
    });

    it('rethrows queue errors that merely carry a code', async () => {
      queueFailure = Object.assign(new Error('Queue refused'), {
        code: 'EREFUSED',
      });
      await assert.rejects(reply(), /Queue refused/);
    });

    it('resolves a duplicate key race to the stored reply or a conflict', async () => {
      const winner = await createMessage({
        idempotencyKey: 'race',
        idempotencyKeys: ['race'],
      });
      sinon.stub(SupportMessage, 'create').rejects(duplicateError());
      missFirstFindOne();
      const repeated = await reply('Fictional reply', 'race');
      assert.equal(String(repeated._id), String(winner._id));
    });

    it('rejects a duplicate key race over a different payload', async () => {
      await createMessage({
        idempotencyKey: 'race',
        idempotencyKeys: ['race'],
      });
      sinon.stub(SupportMessage, 'create').rejects(duplicateError());
      missFirstFindOne();
      await rejects(reply('Different', 'race'), KEY_USED);
    });

    it('rethrows a duplicate error that matches no stored reply', async () => {
      sinon.stub(SupportMessage, 'create').rejects(duplicateError());
      await assert.rejects(reply('Hi', 'nothing-stored'), /duplicate/);
    });
  });

  describe('retrying a reply', () => {
    let failed: Awaited<ReturnType<typeof createMessage>>;

    beforeEach(async () => {
      failed = await createMessage({
        deliveryState: 'failed',
        errorCode: 'queue_failed',
        acceptedAt: new Date(),
        activityAppliedAt: new Date(),
      });
    });

    const retry = (key: unknown = 'retry', confirm: unknown = undefined) =>
      emailService.retryReply(
        requestId,
        String(failed._id),
        actor,
        key,
        confirm,
      );
    const setFailed = (set: Record<string, unknown>) =>
      SupportMessage.updateOne({ _id: failed._id }, { $set: set });

    /** Replaces the addressed reply with a fresh one created after a bystander. */
    async function withBystander(bystanderPatch: Record<string, unknown>) {
      await SupportMessage.deleteOne({ _id: failed._id });
      const bystander = await createMessage(bystanderPatch);
      failed = await createMessage({ deliveryState: 'failed' });
      return bystander;
    }

    /** Makes the claim miss and serves `current` as the re-read reply. */
    async function lostClaim() {
      sinon.stub(SupportMessage, 'findOneAndUpdate').resolves(null as never);
      const stored = await state(failed._id);
      const findById = sinon.stub(SupportMessage, 'findById');
      return (patch: Record<string, unknown>) => {
        const current = { ...stored, ...patch };
        findById.returns({ lean: async () => current } as never);
      };
    }

    it('reports a disabled inbox', async () => {
      config.supportInbox.enabled = false;
      await rejects(retry(), DISABLED);
    });

    it('requires a trimmed idempotency key of at most 200 characters', async () => {
      for (const key of [null, 5, '', ' \n ']) {
        await rejects(retry(key), KEY_REQUIRED);
      }
      await rejects(retry('k'.repeat(201)), KEY_TOO_LONG);
      await retry(` ${'k'.repeat(200)} `);
      assert.deepEqual((await state(failed._id)).idempotencyKeys, [
        'k'.repeat(200),
      ]);
    });

    it('requeues a failed reply and clears its delivery outcome', async () => {
      await setRequest({
        $set: { statusRevision: 3, lastActivityAt: new Date('2025-02-01') },
      });
      const queued = await retry();
      assert.equal(queued.deliveryState, 'queued');
      assert.deepEqual(calls, [
        {
          name: 'send support message',
          data: { messageId: String(failed._id) },
        },
      ]);
      const saved = await state(failed._id);
      assert.equal(saved.deliveryState, 'queued');
      assert.equal(saved.requestRevision, 3);
      assert.equal(
        saved.requestActivityAt?.toISOString(),
        '2025-02-01T00:00:00.000Z',
      );
      assert.equal(saved.errorCode, undefined);
      assert.equal(saved.acceptedAt, undefined);
      assert.equal(saved.activityAppliedAt, undefined);
      assert.deepEqual(saved.idempotencyKeys, ['retry']);
    });

    it('records no activity time for a request that never had any', async () => {
      await setRequest({ $unset: { lastActivityAt: 1 } });
      await retry();
      assert.equal((await state(failed._id)).requestActivityAt, null);
    });

    it('returns the message for a repeated retry that is already in progress', async () => {
      for (const deliveryState of IN_PROGRESS) {
        await setFailed({ deliveryState, idempotencyKeys: ['retry'] });
        assert.equal((await retry()).deliveryState, deliveryState);
      }
      assert.equal(calls.length, 0);
    });

    it('rejects a retry key that belongs to another reply', async () => {
      await createMessage({
        idempotencyKeys: ['retry'],
        idempotencyKey: 'retry',
      });
      await rejects(retry(), KEY_USED);
    });

    it('needs the reply and request to exist', async () => {
      await rejects(
        emailService.retryReply(
          requestId,
          String(new mongoose.Types.ObjectId()),
          actor,
          'retry',
          true,
        ),
        NO_REPLY,
      );
      await SupportRequest.deleteOne({ _id: requestId });
      await rejects(retry(), NO_REQUEST);
    });

    it('asks for confirmation before retrying an uncertain delivery', async () => {
      await setFailed({ deliveryState: 'uncertain' });
      await rejects(retry(), UNCERTAIN);
      await rejects(retry('retry', 'true'), UNCERTAIN);
      assert.equal(calls.length, 0);
      assert.equal((await retry('retry', true)).deliveryState, 'queued');
      assert.equal(calls.length, 1);
    });

    it('only retries failed or uncertain replies', async () => {
      for (const deliveryState of ['received', ...IN_PROGRESS]) {
        await setFailed({ deliveryState });
        await rejects(retry(), NOT_RETRYABLE);
      }
    });

    it('claims only the addressed reply', async () => {
      const bystander = await withBystander({ deliveryState: 'failed' });
      await retry();
      assert.equal((await state(bystander._id)).deliveryState, 'failed');
      assert.equal((await state(failed._id)).deliveryState, 'queued');
    });

    it('reports a key already used by another reply when claiming', async () => {
      await createMessage({ idempotencyKeys: ['retry'] });
      missFirstFindOne();
      await rejects(retry(), KEY_USED);
    });

    it('rethrows other claim errors', async () => {
      sinon
        .stub(SupportMessage, 'findOneAndUpdate')
        .rejects(Object.assign(new Error('Claim broke'), { code: 5 }));
      await assert.rejects(retry(), /Claim broke/);
    });

    it('reports a reply that changed before it could be claimed', async () => {
      sinon.stub(SupportMessage, 'findOneAndUpdate').resolves(null as never);
      await rejects(retry(), CHANGED);
    });

    it('returns a reply a concurrent retry already queued under this key', async () => {
      const serve = await lostClaim();
      for (const keys of [
        { idempotencyKey: 'retry' },
        { idempotencyKeys: ['retry'] },
      ]) {
        for (const deliveryState of IN_PROGRESS) {
          serve({ ...keys, deliveryState });
          assert.equal((await retry()).deliveryState, deliveryState);
        }
      }
    });

    it('rejects a concurrent retry whose key does not match or whose reply is not in progress', async () => {
      const serve = await lostClaim();
      for (const patch of [
        { idempotencyKeys: ['other'], deliveryState: 'queued' },
        { idempotencyKey: 'retry', deliveryState: 'failed' },
        { idempotencyKeys: ['retry'], deliveryState: 'uncertain' },
        { idempotencyKeys: ['retry'], deliveryState: 'received' },
      ]) {
        serve(patch);
        await rejects(retry(), CHANGED);
      }
    });

    it('marks the reply failed again when the send job cannot be queued', async () => {
      const bystander = await withBystander({});
      queueFailure = new Error('Queue down');
      await assert.rejects(retry(), /Queue down/);
      assert.deepEqual(outcome(await state(failed._id)), [
        'failed',
        'queue_failed',
      ]);
      assert.equal((await state(bystander._id)).deliveryState, 'queued');
    });
  });
});

describe('Support email service validation and recovery boundaries', () => {
  const Request =
    mongoose.model<
      import('../../server/models/support.server.model.mts').SupportRequestRecord
    >('SupportRequest');
  const Message =
    mongoose.model<
      import('../../server/models/support-message.server.model.mts').SupportMessageRecord
    >('SupportMessage');
  const actor = {
    _id: new mongoose.Types.ObjectId(),
    username: 'fictional-helper',
  };
  const missingId = new mongoose.Types.ObjectId().toString();
  const originalSender = config.supportInbox.fromAddress;

  function expectCode(code: string) {
    return (error: unknown) =>
      error instanceof SupportEmailError && error.code === code;
  }

  async function request() {
    return Request.create({
      category: 'other',
      email: 'requester@example.org',
      message: 'Fictional request',
      status: 'open',
      statusRevision: 0,
    });
  }

  function stubQueue() {
    const save = sinon.stub().resolves();
    sinon.stub(agenda, 'create').returns({ save } as never);
    return save;
  }

  beforeEach(() => {
    config.supportInbox.enabled = true;
  });
  afterEach(async () => {
    sinon.restore();
    config.supportInbox.enabled = false;
    config.supportInbox.fromAddress = originalSender;
    await utils.clearDatabase();
  });

  it('rejects non-text, oversized text and absent or blank submission keys', async () => {
    for (const body of [null, 'x'.repeat(20001)]) {
      await assert.rejects(
        emailService.queueReply(missingId, actor, body, 'key'),
        expectCode('invalid'),
      );
    }
    for (const key of [undefined, null, '  ']) {
      await assert.rejects(
        emailService.queueReply(missingId, actor, 'Reply', key),
        expectCode('invalid'),
      );
    }
    await assert.rejects(
      emailService.queueReply(missingId, actor, 'Reply', 'key'),
      expectCode('not-found'),
    );
    const report = await request();
    await Request.updateOne({ _id: report._id }, { $unset: { email: 1 } });
    await assert.rejects(
      emailService.queueReply(String(report._id), actor, 'Reply', 'key'),
      expectCode('invalid'),
    );
    await Request.updateOne(
      { _id: report._id },
      { $set: { email: 'invalid' } },
    );
    await assert.rejects(
      emailService.queueReply(String(report._id), actor, 'Reply', 'key'),
      expectCode('invalid'),
    );
    await Request.updateOne(
      { _id: report._id },
      { $set: { email: 'requester@example.org' } },
    );
    config.supportInbox.fromAddress = '';
    await assert.rejects(
      emailService.queueReply(String(report._id), actor, 'Reply', 'key'),
      expectCode('disabled'),
    );
  });

  it('retains initial and latest threading identifiers without duplicates', async () => {
    stubQueue();
    const report = await request();
    await Request.updateOne(
      { _id: report._id },
      { $set: { initialMessageId: '<initial@example.org>' } },
    );
    const first = await emailService.queueReply(
      String(report._id),
      actor,
      'First\r\nreply',
      'first',
    );
    assert.equal(first.body, 'First\nreply');
    assert.equal(first.authorName, actor.username);
    assert.equal(first.inReplyTo, '<initial@example.org>');
    assert.deepEqual(first.references, ['<initial@example.org>']);
    const second = await emailService.queueReply(
      String(report._id),
      { _id: actor._id },
      'Second reply',
      'second',
    );
    assert.equal(second.inReplyTo, first.messageId);
    assert.deepEqual(second.references, [
      '<initial@example.org>',
      first.messageId,
    ]);
    await Message.deleteMany({});
    await Message.create({
      request: report._id,
      direction: 'inbound',
      kind: 'reply',
      body: 'Fictional inbound',
      messageId: '<initial@example.org>',
      deliveryState: 'received',
    });
    const third = await emailService.queueReply(
      String(report._id),
      actor,
      'Third reply',
      'third',
    );
    assert.deepEqual(third.references, ['<initial@example.org>']);
  });

  it('marks a durable message failed when the queue is unavailable', async () => {
    const save = stubQueue();
    save.rejects(new Error('Queue unavailable'));
    const report = await request();
    await assert.rejects(
      emailService.queueReply(
        String(report._id),
        actor,
        'Retain this reply',
        'queue-failure',
      ),
      /Queue unavailable/,
    );
    const saved = await Message.findOne({ request: report._id }).lean();
    assert.ok(saved);
    assert.equal(saved.deliveryState, 'failed');
    assert.equal(saved.errorCode, 'queue_failed');
    assert.equal(saved.body, 'Retain this reply');
  });

  it('enforces retry permission-independent state, confirmation and key validation', async () => {
    stubQueue();
    for (const key of [undefined, ' ', 'x'.repeat(201)]) {
      await assert.rejects(
        emailService.retryReply(missingId, missingId, actor, key, false),
        expectCode('invalid'),
      );
    }
    await assert.rejects(
      emailService.retryReply(missingId, missingId, actor, 'retry', false),
      expectCode('not-found'),
    );
    const report = await request();
    const message = await emailService.queueReply(
      String(report._id),
      actor,
      'Fictional reply',
      'initial',
    );
    await assert.rejects(
      emailService.retryReply(
        String(report._id),
        String(message._id),
        actor,
        'retry',
        false,
      ),
      expectCode('conflict'),
    );
    await Message.updateOne(
      { _id: message._id },
      { $set: { deliveryState: 'uncertain' } },
    );
    await assert.rejects(
      emailService.retryReply(
        String(report._id),
        String(message._id),
        actor,
        'retry',
        false,
      ),
      expectCode('uncertain'),
    );
    const retried = await emailService.retryReply(
      String(report._id),
      String(message._id),
      actor,
      'retry',
      true,
    );
    assert.equal(retried.deliveryState, 'queued');
    const repeated = await emailService.retryReply(
      String(report._id),
      String(message._id),
      actor,
      'retry',
      true,
    );
    assert.equal(String(repeated._id), String(message._id));
    const second = await emailService.queueReply(
      String(report._id),
      actor,
      'Another reply',
      'another',
    );
    await assert.rejects(
      emailService.retryReply(
        String(report._id),
        String(second._id),
        actor,
        'retry',
        true,
      ),
      expectCode('conflict'),
    );
  });

  it('retains a failed reply when scheduling its explicit retry fails', async () => {
    const save = stubQueue();
    const report = await request();
    const message = await emailService.queueReply(
      String(report._id),
      actor,
      'Fictional reply',
      'initial',
    );
    await Message.updateOne(
      { _id: message._id },
      { $set: { deliveryState: 'failed' } },
    );
    save.rejects(new Error('Retry queue unavailable'));
    await assert.rejects(
      emailService.retryReply(
        String(report._id),
        String(message._id),
        actor,
        'retry',
        false,
      ),
      /Retry queue unavailable/,
    );
    const saved = await Message.findById(message._id).lean();
    assert.equal(saved?.deliveryState, 'failed');
    assert.equal(saved?.errorCode, 'queue_failed');
    save.resolves();
    const retried = await emailService.retryReply(
      String(report._id),
      String(message._id),
      actor,
      'retry',
      false,
    );
    assert.equal(retried.deliveryState, 'queued');
  });

  it('rejects use of an acknowledgement key for an ordinary reply', async () => {
    stubQueue();
    const report = await request();
    await emailService.queueAcknowledgement(String(report._id));
    await assert.rejects(
      emailService.queueReply(
        String(report._id),
        actor,
        'Different correspondence',
        `ack:${report._id}`,
      ),
      expectCode('conflict'),
    );
  });

  it('refuses to retry correspondence after its request has been removed', async () => {
    const save = stubQueue();
    const report = await request();
    const message = await emailService.queueReply(
      String(report._id),
      actor,
      'Fictional reply',
      'original',
    );
    await Message.updateOne(
      { _id: message._id },
      { $set: { deliveryState: 'failed' } },
    );
    await Request.deleteOne({ _id: report._id });
    await assert.rejects(
      emailService.retryReply(
        String(report._id),
        String(message._id),
        actor,
        'retry',
        false,
      ),
      expectCode('not-found'),
    );
    assert.equal(save.callCount, 1);
  });

  it('starts a new activity snapshot when an accepted reply is retried after a bounce', async () => {
    stubQueue();
    const report = await request();
    const message = await emailService.queueReply(
      String(report._id),
      actor,
      'Fictional reply',
      'original',
    );
    const earlier = new Date('2025-01-01T00:00:00Z');
    const latest = new Date('2025-01-02T00:00:00Z');
    await Message.updateOne(
      { _id: message._id },
      {
        $set: {
          deliveryState: 'failed',
          acceptedAt: earlier,
          activityAppliedAt: earlier,
        },
      },
    );
    await Request.updateOne(
      { _id: report._id },
      { $set: { status: 'open', statusRevision: 4, lastActivityAt: latest } },
    );
    const retried = await emailService.retryReply(
      String(report._id),
      String(message._id),
      actor,
      'retry',
      false,
    );
    assert.equal(retried.requestRevision, 4);
    assert.equal(retried.requestActivityAt?.getTime(), latest.getTime());
    assert.equal(retried.acceptedAt, undefined);
    assert.equal(retried.activityAppliedAt, undefined);
    assert.equal(retried.idempotencyKey, 'original');
  });

  it('recovers concurrent duplicate inserts and rejects a different winning message', async () => {
    stubQueue();
    const report = await request();
    const originalCreate = Message.create.bind(Message);
    for (const variant of ['same', 'body', 'kind'] as const) {
      const key = `insert-race-${variant}`;
      const stub = sinon.stub(Message, 'create').callsFake((async (
        input: import('../../server/models/support-message.server.model.mts').SupportMessageRecord,
      ) => {
        await originalCreate({
          ...input,
          ...(variant === 'body' && { body: 'Another winning reply' }),
          ...(variant === 'kind' && { kind: 'acknowledgement' }),
        });
        return originalCreate(input);
      }) as never);
      if (variant === 'same') {
        const saved = await emailService.queueReply(
          String(report._id),
          actor,
          'Concurrent reply',
          key,
        );
        assert.equal(saved.body, 'Concurrent reply');
      } else {
        await assert.rejects(
          emailService.queueReply(
            String(report._id),
            actor,
            'Concurrent reply',
            key,
          ),
          expectCode('conflict'),
        );
      }
      stub.restore();
    }
    assert.equal(await Message.countDocuments({ request: report._id }), 3);
  });

  it('propagates unexpected storage failures and unrelated duplicate keys', async () => {
    const report = await request();
    for (const failure of [
      null,
      'storage failure',
      {},
      { code: 'unknown' },
      { code: 11000 },
    ]) {
      const stub = sinon.stub(Message, 'create').callsFake((async () => {
        throw failure;
      }) as never);
      try {
        await emailService.queueReply(
          String(report._id),
          actor,
          'Fictional reply',
          'failed-insert',
        );
        assert.fail('The storage failure must propagate');
      } catch (error) {
        assert.equal(error, failure);
      }
      stub.restore();
    }
  });

  it('distinguishes retry-key uniqueness failures from other storage errors', async () => {
    stubQueue();
    const report = await request();
    const message = await emailService.queueReply(
      String(report._id),
      actor,
      'Fictional reply',
      'initial',
    );
    await Message.updateOne(
      { _id: message._id },
      { $set: { deliveryState: 'failed' } },
    );
    for (const failure of [
      null,
      'storage failure',
      {},
      { code: 'unknown' },
      { code: 11000 },
    ]) {
      const stub = sinon
        .stub(Message, 'findOneAndUpdate')
        .callsFake((async () => {
          throw failure;
        }) as never);
      if (
        failure &&
        typeof failure === 'object' &&
        'code' in failure &&
        failure.code === 11000
      ) {
        await assert.rejects(
          emailService.retryReply(
            String(report._id),
            String(message._id),
            actor,
            'retry',
            false,
          ),
          expectCode('conflict'),
        );
      } else {
        try {
          await emailService.retryReply(
            String(report._id),
            String(message._id),
            actor,
            'retry',
            false,
          );
          assert.fail('The storage failure must propagate');
        } catch (error) {
          assert.equal(error, failure);
        }
      }
      stub.restore();
    }
  });

  it('recognises another worker winning the same retry and refuses conflicting changes', async () => {
    const save = stubQueue();
    for (const variant of [
      'legacy-key',
      'key-set',
      'other-key',
      'failed',
      'deleted',
    ] as const) {
      const report = await request();
      const message = await emailService.queueReply(
        String(report._id),
        actor,
        'Fictional reply',
        'initial',
      );
      await Message.updateOne(
        { _id: message._id },
        { $set: { deliveryState: 'failed' } },
      );
      const stub = sinon
        .stub(Message, 'findOneAndUpdate')
        .callsFake((async () => {
          if (variant === 'deleted')
            await Message.deleteOne({ _id: message._id });
          else
            await Message.updateOne(
              { _id: message._id },
              {
                $set: {
                  deliveryState: variant === 'failed' ? 'failed' : 'queued',
                  idempotencyKey:
                    variant === 'legacy-key' ? 'retry' : 'initial',
                  idempotencyKeys:
                    variant === 'key-set' || variant === 'failed'
                      ? ['initial', 'retry']
                      : ['initial'],
                },
              },
            );
          return null;
        }) as never);
      const queuedBefore = save.callCount;
      if (variant === 'legacy-key' || variant === 'key-set') {
        const current = await emailService.retryReply(
          String(report._id),
          String(message._id),
          actor,
          'retry',
          false,
        );
        assert.equal(current.deliveryState, 'queued');
      } else {
        await assert.rejects(
          emailService.retryReply(
            String(report._id),
            String(message._id),
            actor,
            'retry',
            false,
          ),
          expectCode('conflict'),
        );
      }
      assert.equal(save.callCount, queuedBefore);
      stub.restore();
    }
  });
});

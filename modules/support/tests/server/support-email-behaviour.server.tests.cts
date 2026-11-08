const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const agenda: typeof import('../../../../config/lib/agenda.mjs').default = require('../../../../config/lib/agenda.mjs');
const emailService: typeof import('../../server/services/support-email.server.service.mts') = require('../../server/services/support-email.server.service.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

const { SupportEmailError } = emailService;
const SupportRequest = mongoose.model('SupportRequest');
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

async function rejection(promise: Promise<unknown>): Promise<Rejection> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SupportEmailError, String(error));
    assert.equal(error.name, 'SupportEmailError');
    return { code: error.code, status: error.status, message: error.message };
  }
  throw new assert.AssertionError({ message: 'Expected a rejection' });
}

function stubAgenda(failure?: Error) {
  const calls: Array<{ name: string; data: Record<string, unknown> }> = [];
  sinon.stub(agenda, 'create').callsFake(((
    name: string,
    data: Record<string, unknown>,
  ) => ({
    save: async () => {
      calls.push({ name, data });
      if (failure) throw failure;
    },
  })) as never);
  return calls;
}

describe('Support email service behaviour', () => {
  let requestId: string;

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

  beforeEach(async () => {
    config.supportInbox.enabled = true;
    config.supportInbox.fromAddress = 'support@example.org';
    requestId = String((await createRequest())._id);
  });

  afterEach(async () => {
    sinon.restore();
    Object.assign(config.supportInbox, originalInbox);
    await utils.clearDatabase();
  });

  describe('queueing a reply', () => {
    it('reports a disabled inbox', async () => {
      config.supportInbox.enabled = false;
      assert.deepEqual(
        await rejection(emailService.queueReply(requestId, actor, 'Hi', 'k')),
        { code: 'disabled', status: 503, message: 'Support inbox is disabled' },
      );
    });

    it('reports an unusable sender address', async () => {
      config.supportInbox.fromAddress = 'not-an-address';
      stubAgenda();
      assert.deepEqual(
        await rejection(emailService.queueReply(requestId, actor, 'Hi', 'k')),
        {
          code: 'disabled',
          status: 503,
          message: 'Support sender address is not configured',
        },
      );
    });

    it('rejects bodies that are not text, empty or too long', async () => {
      stubAgenda();
      const text = {
        code: 'invalid',
        status: 400,
        message: 'Reply body must be text',
      };
      const length = {
        code: 'invalid',
        status: 400,
        message: 'Reply body length is invalid',
      };
      for (const body of [undefined, null, 5, {}]) {
        assert.deepEqual(
          await rejection(emailService.queueReply(requestId, actor, body, 'k')),
          text,
        );
      }
      for (const body of ['', ' \r\n\t ', 'x'.repeat(20001)]) {
        assert.deepEqual(
          await rejection(emailService.queueReply(requestId, actor, body, 'k')),
          length,
        );
      }
      const maximal = await emailService.queueReply(
        requestId,
        actor,
        'x'.repeat(20000),
        'k',
      );
      assert.equal(maximal.body.length, 20000);
    });

    it('normalises line endings and surrounding whitespace in the stored body', async () => {
      stubAgenda();
      const queued = await emailService.queueReply(
        requestId,
        actor,
        '  one\r\ntwo\rthree  ',
        'k',
      );
      assert.equal(queued.body, 'one\ntwo\nthree');
    });

    it('requires a trimmed idempotency key of at most 200 characters', async () => {
      stubAgenda();
      const missing = {
        code: 'invalid',
        status: 400,
        message: 'An idempotency key is required',
      };
      for (const key of [undefined, 5, '', '   ']) {
        assert.deepEqual(
          await rejection(emailService.queueReply(requestId, actor, 'Hi', key)),
          missing,
        );
      }
      assert.deepEqual(
        await rejection(
          emailService.queueReply(requestId, actor, 'Hi', 'k'.repeat(201)),
        ),
        {
          code: 'invalid',
          status: 400,
          message: 'Idempotency key is too long',
        },
      );
      const queued = await emailService.queueReply(
        requestId,
        actor,
        'Hi',
        ` ${'k'.repeat(200)} `,
      );
      assert.equal(queued.idempotencyKey, 'k'.repeat(200));
      assert.deepEqual(queued.idempotencyKeys, ['k'.repeat(200)]);
    });

    it('requires an existing request with a valid email address', async () => {
      stubAgenda();
      assert.deepEqual(
        await rejection(
          emailService.queueReply(
            String(new mongoose.Types.ObjectId()),
            actor,
            'Hi',
            'k',
          ),
        ),
        {
          code: 'not-found',
          status: 404,
          message: 'Support request not found',
        },
      );
      const bad = await createRequest({ email: 'nobody' });
      const none = await createRequest();
      await SupportRequest.updateOne(
        { _id: none._id },
        { $unset: { email: 1 } },
      );
      for (const id of [bad._id, none._id]) {
        assert.deepEqual(
          await rejection(
            emailService.queueReply(String(id), actor, 'Hi', 'k'),
          ),
          {
            code: 'invalid',
            status: 400,
            message: 'Request has no valid email address',
          },
        );
      }
    });

    it('returns the earlier reply for a repeated key and rejects a different payload', async () => {
      const calls = stubAgenda();
      const first = await emailService.queueReply(requestId, actor, 'Hi', 'k');
      const create = sinon.spy(SupportMessage, 'create');
      const repeated = await emailService.queueReply(
        requestId,
        actor,
        'Hi',
        'k',
      );
      assert.equal(String(repeated._id), String(first._id));
      assert.equal(calls.length, 1);
      assert.equal(create.callCount, 0);
      const conflict = {
        code: 'conflict',
        status: 409,
        message: 'Idempotency key was already used',
      };
      assert.deepEqual(
        await rejection(
          emailService.queueReply(requestId, actor, 'Other', 'k'),
        ),
        conflict,
      );
      const ack = await emailService.queueAcknowledgement(requestId);
      assert.equal(ack.kind, 'acknowledgement');
      assert.deepEqual(
        await rejection(
          emailService.queueReply(
            requestId,
            actor,
            ACK_TEXT,
            `ack:${requestId}`,
          ),
        ),
        conflict,
      );
      assert.equal(await SupportMessage.countDocuments(), 2);
    });

    it('queues the send job for the stored message', async () => {
      const calls = stubAgenda();
      const queued = await emailService.queueReply(requestId, actor, 'Hi', 'k');
      assert.deepEqual(calls, [
        {
          name: 'send support message',
          data: { messageId: String(queued._id) },
        },
      ]);
      assert.equal(queued.deliveryState, 'queued');
      assert.equal(String(queued.authorId), String(actor._id));
      assert.equal(queued.authorName, 'Fictional helper');
    });

    it('uses a message id on the sender domain', async () => {
      stubAgenda();
      config.supportInbox.fromAddress = '"a@b"@sender.example.org';
      const queued = await emailService.queueReply(requestId, actor, 'Hi', 'k');
      assert.match(queued.messageId, /^<[\da-f-]{36}@sender\.example\.org>$/);
    });

    it('threads onto the request and the most recent message', async () => {
      stubAgenda();
      await SupportRequest.updateOne(
        { _id: requestId },
        {
          $set: {
            initialMessageId: '<initial@example.org>',
            statusRevision: 4,
          },
        },
      );
      const t = (day: number) => new Date(Date.UTC(2025, 0, day));
      const other = await createRequest();
      await createMessage({
        createdAt: t(1),
        messageId: '<oldest@example.org>',
      });
      await createMessage({
        createdAt: t(9),
        messageId: '<newest@example.org>',
      });
      await createMessage({
        createdAt: t(5),
        messageId: '<middle@example.org>',
      });
      await createMessage({
        request: other._id,
        createdAt: t(20),
        messageId: '<elsewhere@example.org>',
      });
      const queued = await emailService.queueReply(requestId, actor, 'Hi', 'k');
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
      stubAgenda();
      const sameTime = new Date('2025-01-01T00:00:00Z');
      await createMessage({
        createdAt: sameTime,
        messageId: '<first@example.org>',
      });
      await createMessage({
        createdAt: sameTime,
        messageId: '<second@example.org>',
      });
      const queued = await emailService.queueReply(requestId, actor, 'Hi', 'k');
      assert.equal(queued.inReplyTo, '<second@example.org>');
    });

    it('does not repeat the request message id in the references', async () => {
      stubAgenda();
      await SupportRequest.updateOne(
        { _id: requestId },
        { $set: { initialMessageId: '<initial@example.org>' } },
      );
      const queued = await emailService.queueReply(requestId, actor, 'Hi', 'k');
      assert.equal(queued.inReplyTo, '<initial@example.org>');
      assert.deepEqual(queued.references, ['<initial@example.org>']);
      await SupportMessage.deleteOne({ _id: queued._id });
      await createMessage({ messageId: '<initial@example.org>' });
      const again = await emailService.queueReply(requestId, actor, 'Hi', 'k2');
      assert.deepEqual(again.references, ['<initial@example.org>']);
    });

    it('starts a thread with empty references', async () => {
      stubAgenda();
      const queued = await emailService.queueReply(requestId, actor, 'Hi', 'k');
      assert.deepEqual(queued.references, []);
      assert.equal(queued.inReplyTo, undefined);
    });

    it('marks a reply failed when the send job cannot be queued', async () => {
      const bystander = await createMessage();
      stubAgenda(new Error('Queue down'));
      await assert.rejects(
        emailService.queueReply(requestId, actor, 'Hi', 'k'),
        /Queue down/,
      );
      assert.equal((await state(bystander._id)).deliveryState, 'queued');
      const failed = await SupportMessage.findOne({
        idempotencyKey: 'k',
      }).lean();
      assert.equal(failed?.deliveryState, 'failed');
      assert.equal(failed?.errorCode, 'queue_failed');
    });

    it('keeps an acknowledgement queued when the send job cannot be queued', async () => {
      stubAgenda(new Error('Queue down'));
      await assert.rejects(emailService.queueAcknowledgement(requestId));
      const ack = await SupportMessage.findOne({
        kind: 'acknowledgement',
      }).lean();
      assert.equal(ack?.deliveryState, 'queued');
      assert.equal(ack?.errorCode, 'queue_failed');
    });

    it('rethrows queue errors that merely carry a code', async () => {
      stubAgenda(
        Object.assign(new Error('Queue refused'), { code: 'EREFUSED' }),
      );
      await assert.rejects(
        emailService.queueReply(requestId, actor, 'Hi', 'k'),
        /Queue refused/,
      );
    });

    it('resolves a duplicate key race to the stored reply or a conflict', async () => {
      stubAgenda();
      const winner = await createMessage({
        idempotencyKey: 'race',
        idempotencyKeys: ['race'],
      });
      const create = sinon.stub(SupportMessage, 'create');
      create.rejects(Object.assign(new Error('duplicate'), { code: 11000 }));
      const real = SupportMessage.findOne.bind(SupportMessage);
      const findOne = sinon.stub(SupportMessage, 'findOne');
      findOne.onFirstCall().returns({ lean: async () => null } as never);
      findOne.callsFake(real as never);
      const repeated = await emailService.queueReply(
        requestId,
        actor,
        'Fictional reply',
        'race',
      );
      assert.equal(String(repeated._id), String(winner._id));
    });

    it('rejects a duplicate key race over a different payload', async () => {
      stubAgenda();
      await createMessage({
        idempotencyKey: 'race',
        idempotencyKeys: ['race'],
      });
      sinon
        .stub(SupportMessage, 'create')
        .rejects(Object.assign(new Error('duplicate'), { code: 11000 }));
      const real = SupportMessage.findOne.bind(SupportMessage);
      const findOne = sinon.stub(SupportMessage, 'findOne');
      findOne.onFirstCall().returns({ lean: async () => null } as never);
      findOne.callsFake(real as never);
      assert.deepEqual(
        await rejection(
          emailService.queueReply(requestId, actor, 'Different', 'race'),
        ),
        {
          code: 'conflict',
          status: 409,
          message: 'Idempotency key was already used',
        },
      );
    });

    it('rethrows a duplicate error that matches no stored reply', async () => {
      stubAgenda();
      sinon
        .stub(SupportMessage, 'create')
        .rejects(Object.assign(new Error('duplicate'), { code: 11000 }));
      await assert.rejects(
        emailService.queueReply(requestId, actor, 'Hi', 'nothing-stored'),
        /duplicate/,
      );
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

    it('reports a disabled inbox', async () => {
      config.supportInbox.enabled = false;
      assert.deepEqual(await rejection(retry()), {
        code: 'disabled',
        status: 503,
        message: 'Support inbox is disabled',
      });
    });

    it('requires a trimmed idempotency key of at most 200 characters', async () => {
      stubAgenda();
      for (const key of [null, 5, '', ' \n ']) {
        assert.deepEqual(await rejection(retry(key)), {
          code: 'invalid',
          status: 400,
          message: 'An idempotency key is required',
        });
      }
      assert.deepEqual(await rejection(retry('k'.repeat(201))), {
        code: 'invalid',
        status: 400,
        message: 'Idempotency key is too long',
      });
      await retry(` ${'k'.repeat(200)} `);
      assert.deepEqual((await state(failed._id)).idempotencyKeys, [
        'k'.repeat(200),
      ]);
    });

    it('requeues a failed reply and clears its delivery outcome', async () => {
      const calls = stubAgenda();
      await SupportRequest.updateOne(
        { _id: requestId },
        { $set: { statusRevision: 3, lastActivityAt: new Date('2025-02-01') } },
      );
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
      stubAgenda();
      await SupportRequest.updateOne(
        { _id: requestId },
        { $unset: { lastActivityAt: 1 } },
      );
      await retry();
      assert.equal((await state(failed._id)).requestActivityAt, null);
    });

    it('returns the message for a repeated retry that is already in progress', async () => {
      const calls = stubAgenda();
      for (const deliveryState of [
        'queued',
        'sending',
        'accepted',
        'captured',
      ]) {
        await SupportMessage.updateOne(
          { _id: failed._id },
          { $set: { deliveryState, idempotencyKeys: ['retry'] } },
        );
        const result = await retry();
        assert.equal(result.deliveryState, deliveryState, deliveryState);
      }
      assert.equal(calls.length, 0);
    });

    it('rejects a retry key that belongs to another reply', async () => {
      stubAgenda();
      await createMessage({
        idempotencyKeys: ['retry'],
        idempotencyKey: 'retry',
      });
      assert.deepEqual(await rejection(retry()), {
        code: 'conflict',
        status: 409,
        message: 'Idempotency key was already used',
      });
    });

    it('needs the reply and request to exist', async () => {
      stubAgenda();
      assert.deepEqual(
        await rejection(
          emailService.retryReply(
            requestId,
            String(new mongoose.Types.ObjectId()),
            actor,
            'retry',
            true,
          ),
        ),
        { code: 'not-found', status: 404, message: 'Support reply not found' },
      );
      await SupportRequest.deleteOne({ _id: requestId });
      assert.deepEqual(await rejection(retry()), {
        code: 'not-found',
        status: 404,
        message: 'Support request not found',
      });
    });

    it('asks for confirmation before retrying an uncertain delivery', async () => {
      const calls = stubAgenda();
      await SupportMessage.updateOne(
        { _id: failed._id },
        { $set: { deliveryState: 'uncertain' } },
      );
      const needsConfirmation = {
        code: 'uncertain',
        status: 409,
        message: 'Confirm retry of uncertain delivery',
      };
      assert.deepEqual(await rejection(retry()), needsConfirmation);
      assert.deepEqual(
        await rejection(retry('retry', 'true')),
        needsConfirmation,
      );
      assert.equal(calls.length, 0);
      assert.equal((await retry('retry', true)).deliveryState, 'queued');
      assert.equal(calls.length, 1);
    });

    it('only retries failed or uncertain replies', async () => {
      stubAgenda();
      for (const deliveryState of [
        'received',
        'queued',
        'sending',
        'accepted',
        'captured',
      ]) {
        await SupportMessage.updateOne(
          { _id: failed._id },
          { $set: { deliveryState } },
        );
        assert.deepEqual(await rejection(retry()), {
          code: 'conflict',
          status: 409,
          message: 'Reply cannot be retried in its current state',
        });
      }
    });

    it('claims only the addressed reply', async () => {
      stubAgenda();
      await SupportMessage.deleteOne({ _id: failed._id });
      const bystander = await createMessage({ deliveryState: 'failed' });
      failed = await createMessage({ deliveryState: 'failed' });
      await retry();
      assert.equal((await state(bystander._id)).deliveryState, 'failed');
      assert.equal((await state(failed._id)).deliveryState, 'queued');
    });

    it('reports a key already used by another reply when claiming', async () => {
      stubAgenda();
      await createMessage({ idempotencyKeys: ['retry'] });
      const real = SupportMessage.findOne.bind(SupportMessage);
      sinon
        .stub(SupportMessage, 'findOne')
        .onFirstCall()
        .returns({ lean: async () => null } as never)
        .callsFake(real as never);
      assert.deepEqual(await rejection(retry()), {
        code: 'conflict',
        status: 409,
        message: 'Idempotency key was already used',
      });
    });

    it('rethrows other claim errors', async () => {
      stubAgenda();
      sinon
        .stub(SupportMessage, 'findOneAndUpdate')
        .rejects(Object.assign(new Error('Claim broke'), { code: 5 }));
      await assert.rejects(retry(), /Claim broke/);
    });

    it('reports a reply that changed before it could be claimed', async () => {
      stubAgenda();
      sinon.stub(SupportMessage, 'findOneAndUpdate').resolves(null as never);
      assert.deepEqual(await rejection(retry()), {
        code: 'conflict',
        status: 409,
        message: 'Reply changed while retry was queued',
      });
    });

    it('returns a reply a concurrent retry already queued under this key', async () => {
      stubAgenda();
      sinon.stub(SupportMessage, 'findOneAndUpdate').resolves(null as never);
      const stored = await state(failed._id);
      const findById = sinon.stub(SupportMessage, 'findById');
      for (const keys of [
        { idempotencyKey: 'retry' },
        { idempotencyKeys: ['retry'] },
      ]) {
        for (const deliveryState of [
          'queued',
          'sending',
          'accepted',
          'captured',
        ]) {
          const current = { ...stored, ...keys, deliveryState };
          findById.returns({ lean: async () => current } as never);
          const result = await retry();
          assert.equal(result.deliveryState, deliveryState, deliveryState);
        }
      }
    });

    it('rejects a concurrent retry whose key does not match or whose reply is not in progress', async () => {
      stubAgenda();
      sinon.stub(SupportMessage, 'findOneAndUpdate').resolves(null as never);
      const stored = await state(failed._id);
      const findById = sinon.stub(SupportMessage, 'findById');
      for (const patch of [
        { idempotencyKeys: ['other'], deliveryState: 'queued' },
        { idempotencyKey: 'retry', deliveryState: 'failed' },
        { idempotencyKeys: ['retry'], deliveryState: 'uncertain' },
        { idempotencyKeys: ['retry'], deliveryState: 'received' },
      ]) {
        const current = { ...stored, ...patch };
        findById.returns({ lean: async () => current } as never);
        assert.deepEqual(await rejection(retry()), {
          code: 'conflict',
          status: 409,
          message: 'Reply changed while retry was queued',
        });
      }
    });

    it('marks the reply failed again when the send job cannot be queued', async () => {
      await SupportMessage.deleteOne({ _id: failed._id });
      const bystander = await createMessage();
      failed = await createMessage({ deliveryState: 'failed' });
      stubAgenda(new Error('Queue down'));
      await assert.rejects(retry(), /Queue down/);
      const saved = await state(failed._id);
      assert.equal(saved.deliveryState, 'failed');
      assert.equal(saved.errorCode, 'queue_failed');
      assert.equal((await state(bystander._id)).deliveryState, 'queued');
    });
  });
});

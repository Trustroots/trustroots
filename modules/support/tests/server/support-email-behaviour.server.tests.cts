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
const UNCERTAIN = err('uncertain', 409, 'Confirm retry of uncertain delivery');
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

describe('Support email service behaviour', () => {
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

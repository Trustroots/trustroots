const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const service: typeof import('../../server/services/support-email.server.service.mts') = require('../../server/services/support-email.server.service.mts');
const agenda: typeof import('../../../../config/lib/agenda.mjs').default = require('../../../../config/lib/agenda.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

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
    error instanceof service.SupportEmailError && error.code === code;
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

describe('Support email service validation and recovery boundaries', () => {
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
        service.queueReply(missingId, actor, body, 'key'),
        expectCode('invalid'),
      );
    }
    for (const key of [undefined, null, '  ']) {
      await assert.rejects(
        service.queueReply(missingId, actor, 'Reply', key),
        expectCode('invalid'),
      );
    }
    await assert.rejects(
      service.queueReply(missingId, actor, 'Reply', 'key'),
      expectCode('not-found'),
    );
    const report = await request();
    await Request.updateOne({ _id: report._id }, { $unset: { email: 1 } });
    await assert.rejects(
      service.queueReply(String(report._id), actor, 'Reply', 'key'),
      expectCode('invalid'),
    );
    await Request.updateOne(
      { _id: report._id },
      { $set: { email: 'invalid' } },
    );
    await assert.rejects(
      service.queueReply(String(report._id), actor, 'Reply', 'key'),
      expectCode('invalid'),
    );
    await Request.updateOne(
      { _id: report._id },
      { $set: { email: 'requester@example.org' } },
    );
    config.supportInbox.fromAddress = '';
    await assert.rejects(
      service.queueReply(String(report._id), actor, 'Reply', 'key'),
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
    const first = await service.queueReply(
      String(report._id),
      actor,
      'First\r\nreply',
      'first',
    );
    assert.equal(first.body, 'First\nreply');
    assert.equal(first.authorName, actor.username);
    assert.equal(first.inReplyTo, '<initial@example.org>');
    assert.deepEqual(first.references, ['<initial@example.org>']);
    const second = await service.queueReply(
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
    const third = await service.queueReply(
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
      service.queueReply(
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
        service.retryReply(missingId, missingId, actor, key, false),
        expectCode('invalid'),
      );
    }
    await assert.rejects(
      service.retryReply(missingId, missingId, actor, 'retry', false),
      expectCode('not-found'),
    );
    const report = await request();
    const message = await service.queueReply(
      String(report._id),
      actor,
      'Fictional reply',
      'initial',
    );
    await assert.rejects(
      service.retryReply(
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
      service.retryReply(
        String(report._id),
        String(message._id),
        actor,
        'retry',
        false,
      ),
      expectCode('uncertain'),
    );
    const retried = await service.retryReply(
      String(report._id),
      String(message._id),
      actor,
      'retry',
      true,
    );
    assert.equal(retried.deliveryState, 'queued');
    const repeated = await service.retryReply(
      String(report._id),
      String(message._id),
      actor,
      'retry',
      true,
    );
    assert.equal(String(repeated._id), String(message._id));
    const second = await service.queueReply(
      String(report._id),
      actor,
      'Another reply',
      'another',
    );
    await assert.rejects(
      service.retryReply(
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
    const message = await service.queueReply(
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
      service.retryReply(
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
    const retried = await service.retryReply(
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
    await service.queueAcknowledgement(String(report._id));
    await assert.rejects(
      service.queueReply(
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
    const message = await service.queueReply(
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
      service.retryReply(
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
    const message = await service.queueReply(
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
    const retried = await service.retryReply(
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
        const saved = await service.queueReply(
          String(report._id),
          actor,
          'Concurrent reply',
          key,
        );
        assert.equal(saved.body, 'Concurrent reply');
      } else {
        await assert.rejects(
          service.queueReply(
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
        await service.queueReply(
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
    const message = await service.queueReply(
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
          service.retryReply(
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
          await service.retryReply(
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
      const message = await service.queueReply(
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
        const current = await service.retryReply(
          String(report._id),
          String(message._id),
          actor,
          'retry',
          false,
        );
        assert.equal(current.deliveryState, 'queued');
      } else {
        await assert.rejects(
          service.retryReply(
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

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const {
  applySupportOutboundActivity: applyActivity,
}: typeof import('../../server/services/support-outbound-activity.server.service.mts') = require('../../server/services/support-outbound-activity.server.service.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const Request =
  mongoose.model<
    import('../../server/models/support.server.model.mts').SupportRequestRecord
  >('SupportRequest');
const Message =
  mongoose.model<
    import('../../server/models/support-message.server.model.mts').SupportMessageRecord
  >('SupportMessage');
const initialAt = new Date('2025-01-01T00:00:00Z');
const acceptedAt = new Date('2025-01-02T00:00:00Z');
let sequence = 0;

async function request(status: 'open' | 'new' | 'pending' | 'closed' = 'open') {
  return Request.create({
    category: 'other',
    email: 'fictional@example.org',
    message: 'Fictional request',
    status,
    statusRevision: 0,
    statusChangedAt: initialAt,
    lastActivityAt: initialAt,
  });
}

async function accepted(
  requestId: import('mongoose').Types.ObjectId,
  kind: 'reply' | 'acknowledgement' = 'reply',
) {
  return Message.create({
    request: requestId,
    direction: 'outbound',
    kind,
    body: 'Fictional correspondence',
    messageId: `<fictional-activity-${++sequence}@example.org>`,
    deliveryState: 'accepted',
    acceptedAt,
    requestRevision: 0,
    requestActivityAt: initialAt,
  });
}

describe('Accepted support email activity reconciliation', () => {
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  it('ignores missing, unsent, already reconciled and incomplete acceptance records', async () => {
    await applyActivity(new mongoose.Types.ObjectId());
    const report = await request();
    for (const variant of ['unsent', 'applied', 'no-acceptance'] as const) {
      const message = await accepted(report._id);
      await Message.updateOne(
        { _id: message._id },
        {
          ...(variant === 'unsent' && { $set: { deliveryState: 'queued' } }),
          ...(variant === 'applied' && {
            $set: { activityAppliedAt: initialAt },
          }),
          ...(variant === 'no-acceptance' && { $unset: { acceptedAt: 1 } }),
        },
      );
      await applyActivity(message._id);
      assert.equal(
        (
          await Message.findById(message._id).lean()
        )?.activityAppliedAt?.getTime(),
        variant === 'applied' ? initialAt.getTime() : undefined,
      );
    }
    assert.equal(
      (await Request.findById(report._id).lean())?.statusRevision,
      0,
    );
  });

  it('records skips for records without a revision snapshot or a surviving request', async () => {
    const report = await request();
    const noRevision = await accepted(report._id);
    await Message.updateOne(
      { _id: noRevision._id },
      { $unset: { requestRevision: 1 } },
    );
    await applyActivity(noRevision._id);
    assert.ok(
      (await Message.findById(noRevision._id).lean())?.activityAppliedAt,
    );
    assert.equal(
      (await Request.findById(report._id).lean())?.statusRevision,
      0,
    );
    const orphan = await accepted(new mongoose.Types.ObjectId());
    await applyActivity(orphan._id);
    assert.ok((await Message.findById(orphan._id).lean())?.activityAppliedAt);
  });

  it('applies a reply once and clears prior resolution metadata', async () => {
    const report = await request('closed');
    await Request.updateOne(
      { _id: report._id },
      {
        $set: {
          resolvedAt: initialAt,
          resolvedBy: new mongoose.Types.ObjectId(),
        },
      },
    );
    const message = await accepted(report._id);
    await Promise.all([applyActivity(message._id), applyActivity(message._id)]);
    await applyActivity(message._id);
    const saved = await Request.findById(report._id).lean();
    assert.equal(saved?.status, 'pending');
    assert.equal(saved?.statusRevision, 1);
    assert.equal(saved?.lastActivityAt?.getTime(), acceptedAt.getTime());
    assert.equal(saved?.resolvedAt, null);
    assert.equal(saved?.resolvedBy, null);
    const correspondence = await Message.findById(message._id).lean();
    assert.ok(correspondence?.activityAppliedAt);
    assert.equal(correspondence?.requestRevision, 1);
  });

  it('leaves acknowledgement and already pending status timestamps unchanged', async () => {
    for (const kind of ['acknowledgement', 'reply'] as const) {
      const status = kind === 'acknowledgement' ? 'new' : 'pending';
      const report = await request(status);
      const message = await accepted(report._id, kind);
      await applyActivity(message._id);
      const saved = await Request.findById(report._id).lean();
      assert.equal(saved?.status, status);
      assert.equal(saved?.statusChangedAt?.getTime(), initialAt.getTime());
      assert.equal(saved?.lastActivityAt?.getTime(), acceptedAt.getTime());
    }
  });

  it('does not override newer revisions or changed activity timestamps', async () => {
    for (const variant of ['revision', 'activity'] as const) {
      const report = await request('closed');
      const message = await accepted(report._id);
      await Request.updateOne(
        { _id: report._id },
        {
          $set:
            variant === 'revision'
              ? { statusRevision: 1 }
              : { lastActivityAt: new Date('2025-01-03T00:00:00Z') },
        },
      );
      await applyActivity(message._id);
      assert.equal(
        (await Request.findById(report._id).lean())?.status,
        'closed',
      );
      const saved = await Message.findById(message._id).lean();
      assert.ok(saved?.activityAppliedAt);
      assert.equal(saved?.requestRevision, 0);
    }
  });

  it('reconciles a request whose successful activity write response was lost', async () => {
    const report = await request('pending');
    const message = await accepted(report._id);
    await Request.updateOne(
      { _id: report._id },
      { $set: { statusRevision: 1, lastActivityAt: acceptedAt } },
    );
    await applyActivity(message._id);
    assert.equal(
      (await Message.findById(message._id).lean())?.requestRevision,
      1,
    );
    assert.equal(
      (await Request.findById(report._id).lean())?.statusRevision,
      1,
    );
  });

  it('repairs a failed marker write without repeating the already applied request write', async () => {
    const report = await request();
    const message = await accepted(report._id);
    const stub = sinon
      .stub(Message, 'updateOne')
      .rejects(new Error('Marker unavailable'));
    await assert.rejects(applyActivity(message._id), /Marker unavailable/);
    stub.restore();
    await applyActivity(message._id);
    assert.equal(
      (await Request.findById(report._id).lean())?.statusRevision,
      1,
    );
    assert.ok((await Message.findById(message._id).lean())?.activityAppliedAt);
  });

  it('handles missing historical activity snapshots as null', async () => {
    const report = await request();
    const message = await accepted(report._id);
    await Request.updateOne(
      { _id: report._id },
      { $unset: { lastActivityAt: 1 } },
    );
    await Message.updateOne(
      { _id: message._id },
      { $unset: { requestActivityAt: 1 } },
    );
    await applyActivity(message._id);
    assert.equal(
      (await Request.findById(report._id).lean())?.status,
      'pending',
    );
  });

  it('re-reads a lost CAS race and distinguishes its own write from other activity', async () => {
    for (const variant of ['own-write', 'manual-change', 'deleted'] as const) {
      const report = await request();
      const message = await accepted(report._id);
      const update = Request.updateOne.bind(Request);
      const stub = sinon.stub(Request, 'updateOne').callsFake((async () => {
        if (variant === 'deleted') await Request.deleteOne({ _id: report._id });
        else
          await update(
            { _id: report._id },
            {
              $set: {
                statusRevision: 1,
                status: variant === 'own-write' ? 'pending' : 'closed',
                lastActivityAt:
                  variant === 'own-write' ? acceptedAt : initialAt,
              },
            },
          );
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 0,
          upsertedId: null,
        };
      }) as never);
      await applyActivity(message._id);
      const saved = await Message.findById(message._id).lean();
      assert.ok(saved?.activityAppliedAt);
      assert.equal(saved?.requestRevision, variant === 'own-write' ? 1 : 0);
      stub.restore();
    }
  });
});

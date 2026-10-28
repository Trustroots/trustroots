const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.spam-cleanup.server.controller.mts') = require('../../server/controllers/admin.spam-cleanup.server.controller.mts');
const User = mongoose.connection.collection('users');
const Preview = mongoose.model('SpamCleanupPreview');
const Audit = mongoose.model('AuditLog');
function response() {
  return {
    statusCode: 200,
    body: undefined as unknown as {
      eligible: number;
      protected: number;
      previewId: string;
      hasMore: boolean;
      items: Array<{ id: string }>;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: unknown) {
      this.body = body as typeof this.body;
      return this;
    },
  };
}
describe('Administrator spam account cleanup', () => {
  const admin = {
    _id: new mongoose.Types.ObjectId(),
    roles: ['user', 'admin'],
  };
  async function candidate(username: string) {
    const result = await User.insertOne({
      username,
      email: `${username}@example.test`,
      created: new Date('2021-07-04T12:00:00Z'),
      public: false,
      roles: ['user', 'suspended'],
      avatarUploaded: false,
    });
    return result.insertedId;
  }
  async function preview(body: unknown = {}) {
    const res = response();
    await controller.preview({ body, user: admin }, res);
    return res;
  }
  async function apply(previewId: string, actor = admin) {
    const res = response();
    await controller.apply(
      { body: { previewId, confirm: true }, user: actor },
      res,
    );
    return res;
  }
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
    await Preview.deleteMany({});
  });
  it('previews protected accounts, deletes only reviewed eligible accounts and is repeatable', async () => {
    const eligible = await candidate('fictional-candidate');
    const protectedId = await candidate('fictional-protected');
    await mongoose
      .model('AdminNote')
      .create({ user: protectedId, note: 'Fictional moderation record' });
    const review = await preview();
    assert.equal(review.body.eligible, 1);
    assert.equal(review.body.protected, 1);
    assert.equal(await User.countDocuments({}), 2);
    const result = await apply(review.body.previewId);
    assert.deepEqual(result.body, { deleted: 1, skipped: 0 });
    assert.equal(await User.countDocuments({ _id: eligible }), 0);
    assert.equal(await User.countDocuments({ _id: protectedId }), 1);
    assert.deepEqual((await apply(review.body.previewId)).body, result.body);
    assert.equal((await Audit.find({}).lean()).length, 3);
  });
  it('rechecks restored accounts and new moderation notes before deletion', async () => {
    const restored = await candidate('fictional-restored');
    const noted = await candidate('fictional-noted');
    const review = await preview();
    await User.updateOne({ _id: restored }, { $set: { roles: ['user'] } });
    await mongoose
      .model('AdminNote')
      .create({ user: noted, note: 'Fictional new note' });
    assert.deepEqual((await apply(review.body.previewId)).body, {
      deleted: 0,
      skipped: 2,
    });
    assert.equal(await User.countDocuments({}), 2);
  });
  it('limits pages and binds reviewed IDs to the actor and expiration', async () => {
    for (let i = 0; i < 102; i++) await candidate(`fictional-${i}`);
    const first = await preview();
    assert.equal(first.body.items.length, 100);
    assert.equal(first.body.hasMore, true);
    const next = await preview({ after: first.body.items[99].id });
    assert.equal(next.body.items.length, 2);
    assert.equal(
      (
        await apply(first.body.previewId, {
          ...admin,
          _id: new mongoose.Types.ObjectId(),
        })
      ).statusCode,
      410,
    );
    await Preview.updateOne(
      { _id: first.body.previewId },
      { $set: { expiresAt: new Date(0) } },
    );
    assert.equal((await apply(first.body.previewId)).statusCode, 410);
    await Preview.updateOne(
      { _id: next.body.previewId },
      { $set: { claimed: true } },
    );
    assert.equal((await apply(next.body.previewId)).statusCode, 409);
  });
  it('rejects unprivileged and malformed requests and fails closed on audit failure', async () => {
    for (const body of [
      null,
      [],
      {},
      { previewId: 'bad', confirm: true },
      { previewId: String(new mongoose.Types.ObjectId()), confirm: false },
      {
        previewId: String(new mongoose.Types.ObjectId()),
        confirm: true,
        extra: true,
      },
    ]) {
      const res = response();
      await controller.apply({ body, user: admin }, res);
      assert.equal(res.statusCode, 400);
    }
    for (const body of [null, [], { extra: true }, { after: 'invalid' }])
      assert.equal((await preview(body)).statusCode, 400);
    for (const method of [controller.preview, controller.apply]) {
      const res = response();
      await method(
        { body: {}, user: { ...admin, roles: ['support-team'] } },
        res,
      );
      assert.equal(res.statusCode, 403);
      const anonymous = response();
      await method({ body: {} }, anonymous);
      assert.equal(anonymous.statusCode, 403);
    }
    sinon.stub(Audit.prototype, 'save').rejects(new Error('fictional failure'));
    assert.equal((await preview()).statusCode, 500);
  });
  it('does not delete when apply audit storage fails', async () => {
    await candidate('fictional-audit');
    const review = await preview();
    sinon.stub(Audit.prototype, 'save').rejects(new Error('fictional failure'));
    assert.equal((await apply(review.body.previewId)).statusCode, 500);
    assert.equal(await User.countDocuments({}), 1);
  });
});

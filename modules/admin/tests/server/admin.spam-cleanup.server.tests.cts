const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.spam-cleanup.server.controller.mts') = require('../../server/controllers/admin.spam-cleanup.server.controller.mts');
const User = mongoose.connection.collection('users');
const Preview = mongoose.model('SpamCleanupPreview');
const Chunk = mongoose.model('SpamCleanupChunk');
const Audit = mongoose.model('AuditLog');
interface Body {
  previewId: string;
  eligible: number;
  protected: number;
  candidates: number;
  building: boolean;
  page: number;
  pages: number;
  items: Array<{
    id: string;
    username: string;
    created: string | null;
    eligible: boolean;
  }>;
  deleted: number;
  skipped: number;
  done: boolean;
}
function response() {
  return {
    statusCode: 200,
    body: undefined as unknown as Body,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: unknown) {
      this.body = body as Body;
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
    return (
      await User.insertOne({
        username,
        email: `${username}@example.test`,
        created: new Date('2021-07-04T12:00:00Z'),
        public: false,
        roles: ['user', 'suspended'],
        avatarUploaded: false,
      })
    ).insertedId;
  }
  async function preview(body: unknown = {}, actor = admin) {
    const res = response();
    await controller.preview({ body, user: actor }, res);
    return res;
  }
  async function fullPreview() {
    let res = await preview();
    while (res.body.building)
      res = await preview({ previewId: res.body.previewId });
    return res;
  }
  async function apply(
    previewId: string,
    accountIds: string[] = [],
    selection = 'all',
    actor = admin,
  ) {
    const res = response();
    await controller.apply(
      {
        body: { previewId, confirm: true, selection, accountIds },
        user: actor,
      },
      res,
    );
    return res;
  }
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
    await Preview.deleteMany({});
    await Chunk.deleteMany({});
  });
  it('previews the entire snapshot and applies all except exclusions across pages', async () => {
    for (let i = 0; i < 102; i++) await candidate(`fictional-${i}`);
    const review = await fullPreview();
    assert.equal(review.body.eligible, 102);
    assert.equal(review.body.candidates, 102);
    assert.equal(review.body.pages, 2);
    const firstExcluded = review.body.items[0].id;
    const lastPage = await preview({
      previewId: review.body.previewId,
      page: 2,
    });
    assert.equal(lastPage.body.items.length, 2);
    const lastExcluded = lastPage.body.items[1].id;
    const partial = await apply(review.body.previewId, [
      firstExcluded.toUpperCase(),
      lastExcluded,
    ]);
    assert.equal(partial.body.done, false);
    assert.equal(partial.body.deleted, 99);
    const result = await apply(review.body.previewId, [
      firstExcluded,
      lastExcluded,
    ]);
    assert.deepEqual(result.body, { deleted: 100, skipped: 0, done: true });
    assert.equal(await User.countDocuments({}), 2);
    assert.deepEqual(
      (await apply(review.body.previewId, [lastExcluded, firstExcluded])).body,
      result.body,
    );
    assert.equal((await apply(review.body.previewId, [])).statusCode, 409);
    assert.equal(
      (await preview({ previewId: review.body.previewId })).statusCode,
      409,
    );
  });
  it('retains protected accounts and applies only individually selected accounts', async () => {
    const selected = await candidate('fictional-selected');
    const excluded = await candidate('fictional-excluded');
    const protectedId = await candidate('fictional-protected');
    await mongoose
      .model('AdminNote')
      .create({ user: protectedId, note: 'Fictional moderation record' });
    const review = await fullPreview();
    assert.equal(review.body.protected, 1);
    assert.equal(review.body.eligible, 2);
    assert.deepEqual(
      (await apply(review.body.previewId, [String(selected)], 'selected')).body,
      { deleted: 1, skipped: 0, done: true },
    );
    assert.equal(
      await User.countDocuments({ _id: { $in: [excluded, protectedId] } }),
      2,
    );
    const logs = await Audit.find({}).lean();
    assert.equal(logs.length, 3);
    assert.equal(JSON.stringify(logs).includes('fictional-'), false);
  });
  it('rechecks restored accounts and new notes and tolerates an empty preview', async () => {
    const restored = await candidate('fictional-restored');
    const noted = await candidate('fictional-noted');
    const review = await fullPreview();
    await User.updateOne({ _id: restored }, { $set: { roles: ['user'] } });
    await mongoose
      .model('AdminNote')
      .create({ user: noted, note: 'Fictional new note' });
    assert.deepEqual((await apply(review.body.previewId)).body, {
      deleted: 0,
      skipped: 2,
      done: true,
    });
    await User.deleteMany({});
    const empty = await fullPreview();
    assert.equal(empty.body.candidates, 0);
    assert.deepEqual((await apply(empty.body.previewId)).body, {
      deleted: 0,
      skipped: 0,
      done: true,
    });
  });
  it('rejects unauthorised, expired, unfinished and concurrent operations', async () => {
    for (let i = 0; i < 102; i++) await candidate(`fictional-pending-${i}`);
    const building = await preview();
    assert.equal(building.body.building, true);
    assert.equal((await apply(building.body.previewId)).statusCode, 409);
    await Preview.updateOne(
      { _id: building.body.previewId },
      { $set: { claimed: true } },
    );
    assert.equal(
      (await preview({ previewId: building.body.previewId })).statusCode,
      409,
    );
    await Preview.updateOne(
      { _id: building.body.previewId },
      { $set: { claimed: false } },
    );
    const review = await preview({ previewId: building.body.previewId });
    assert.equal(
      (await preview({ previewId: review.body.previewId, page: 3 })).statusCode,
      400,
    );
    const other = { ...admin, _id: new mongoose.Types.ObjectId() };
    assert.equal(
      (await apply(review.body.previewId, [], 'all', other)).statusCode,
      410,
    );
    assert.equal(
      (await preview({ previewId: review.body.previewId }, other)).statusCode,
      410,
    );
    await Preview.updateOne(
      { _id: review.body.previewId },
      { $set: { claimed: true } },
    );
    assert.equal((await apply(review.body.previewId)).statusCode, 409);
    await Preview.updateOne(
      { _id: review.body.previewId },
      { $set: { expiresAt: new Date(0) } },
    );
    assert.equal((await apply(review.body.previewId)).statusCode, 410);
  });
  it('rejects malformed bodies, choices and page requests', async () => {
    const oid = String(new mongoose.Types.ObjectId());
    for (const body of [
      null,
      [],
      { extra: true },
      { previewId: 'invalid' },
      { page: 1 },
      { page: 0, previewId: oid },
      { page: 1.5, previewId: oid },
      { page: '1', previewId: oid },
    ])
      assert.equal((await preview(body)).statusCode, 400);
    for (const body of [
      null,
      [],
      {},
      { previewId: 'invalid', confirm: true, selection: 'all', accountIds: [] },
      { previewId: oid, confirm: false, selection: 'all', accountIds: [] },
      { previewId: oid, confirm: true, selection: 'bad', accountIds: [] },
      { previewId: oid, confirm: true, selection: 'all', accountIds: null },
      {
        previewId: oid,
        confirm: true,
        selection: 'all',
        accountIds: ['invalid'],
      },
      {
        previewId: oid,
        confirm: true,
        selection: 'all',
        accountIds: [],
        extra: true,
      },
    ]) {
      const res = response();
      await controller.apply({ body, user: admin }, res);
      assert.equal(res.statusCode, 400);
    }
    for (const method of [controller.preview, controller.apply]) {
      for (const user of [undefined, { ...admin, roles: ['support-team'] }]) {
        const res = response();
        await method({ body: {}, user }, res);
        assert.equal(res.statusCode, 403);
      }
    }
  });
  it('fails closed if audit storage or a reviewed chunk is unavailable', async () => {
    sinon.stub(Audit.prototype, 'save').rejects(new Error('Fictional failure'));
    assert.equal((await preview()).statusCode, 500);
    sinon.restore();
    await candidate('fictional-audit');
    const review = await fullPreview();
    sinon.stub(Audit.prototype, 'save').rejects(new Error('Fictional failure'));
    assert.equal((await apply(review.body.previewId)).statusCode, 500);
    assert.equal(await User.countDocuments({}), 1);
    sinon.restore();
    const fresh = await fullPreview();
    await Chunk.deleteMany({ preview: fresh.body.previewId });
    assert.equal((await apply(fresh.body.previewId)).statusCode, 500);
  });
  it('shows deleted or renamed snapshot accounts without changing the snapshot', async () => {
    const id = await candidate('fictional-later-deleted');
    const review = await fullPreview();
    await User.deleteOne({ _id: id });
    const page = await preview({ previewId: review.body.previewId, page: 1 });
    assert.equal(page.body.items[0].username, 'Deleted account');
    assert.equal(page.body.items[0].eligible, false);
    assert.equal(page.body.items[0].created, null);
  });
});

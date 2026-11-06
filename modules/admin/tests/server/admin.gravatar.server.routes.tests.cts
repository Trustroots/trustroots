import type {
  TestExpressApp,
  TestAgent,
} from '../../../../testutils/server/model-contracts.mts';
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const sinon: typeof import('sinon') = require('sinon');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.gravatar.server.controller.mts') = require('../../server/controllers/admin.gravatar.server.controller.mts');
const User = mongoose.model('User');

describe('Admin Gravatar usage', () => {
  let app: TestExpressApp;
  let admin: TestAgent;
  let member: TestAgent;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    const users = utils.generateUsersWithSharedPassword(2);
    users[0].roles = ['user', 'admin'];
    await utils.saveUsersWithCachedPasswords(users);
    admin = request.agent(app);
    member = request.agent(app);
    await admin
      .post('/api/auth/signin')
      .send({ username: users[0].username, password: users[0].password })
      .expect(200);
    await member
      .post('/api/auth/signin')
      .send({ username: users[1].username, password: users[1].password })
      .expect(200);
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });
  it('denies visitors and non-admin roles', async () => {
    await request(app).get('/api/admin/gravatar').expect(403);
    await member.get('/api/admin/gravatar').expect(403);
    for (const role of ['support-team', 'welcome-team']) {
      await User.updateOne(
        { roles: { $ne: 'admin' } },
        { $set: { roles: ['user', role] } },
      );
      await member.get('/api/admin/gravatar').expect(403);
    }
  });
  it('returns an empty count and member list', async () => {
    const response = await admin.get('/api/admin/gravatar').expect(200);
    assert.deepEqual(response.body.members, []);
    assert.equal(response.body.accounts, 0);
    assert.equal(response.body.page, 1);
    assert.equal(response.body.hasNextPage, false);
    assert.ok(Number.isFinite(Date.parse(response.body.measuredAt)));
  });
  it('counts current selections and returns stable bounded pages without private fields', async () => {
    const fixtures = Array.from({ length: 51 }, (_, index) => ({
      username: `fictional-${index}`,
      displayName: 'Fictional Member',
      avatarSource: 'gravatar',
      email: `fictional-${index}@example.test`,
      emailHash: 'private-hash',
    }));
    await User.collection.insertMany(fixtures);
    await User.collection.insertOne({
      username: 'former-gravatar',
      avatarSource: 'none',
    });
    const first = await admin.get('/api/admin/gravatar').expect(200);
    assert.equal(first.body.accounts, 51);
    assert.equal(first.body.members.length, 50);
    assert.equal(first.body.hasNextPage, true);
    assert.deepEqual(Object.keys(first.body.members[0]).sort(), [
      '_id',
      'displayName',
      'username',
    ]);
    assert.equal(first.body.members[0].username, 'fictional-0');
    const second = await admin.get('/api/admin/gravatar?page=2').expect(200);
    assert.equal(second.body.members.length, 1);
    assert.equal(second.body.members[0].username, 'fictional-50');
    assert.equal(second.body.hasNextPage, false);
    const beyond = await admin.get('/api/admin/gravatar?page=3').expect(200);
    assert.equal(beyond.body.accounts, 51);
    assert.deepEqual(beyond.body.members, []);
    await User.updateOne(
      { username: 'fictional-0' },
      { $set: { avatarSource: 'local' } },
    );
    const updated = await admin.get('/api/admin/gravatar').expect(200);
    assert.equal(updated.body.accounts, 50);
    assert.equal(updated.body.members[0].username, 'fictional-1');
  });
  it('rejects excessive page values', async () => {
    await admin.get('/api/admin/gravatar?page=9007199254740992').expect(400);
    await admin.get('/api/admin/gravatar?page=180143985094820').expect(400);
  });
  it('returns an error without leaking database details', async () => {
    sinon.stub(User, 'aggregate').throws(new Error('private database details'));
    const response = await admin.get('/api/admin/gravatar').expect(500);
    assert.deepEqual(response.body, {
      message: 'Could not load Gravatar usage.',
    });
  });
  it('rejects invalid page values in direct controller calls', async () => {
    for (const page of [0, -1, 1.5, '0', '-1', '1.5', 'foo', {}, ['1']]) {
      const res = { status: sinon.stub().returnsThis(), send: sinon.stub() };
      await controller.list({ query: { page } }, res);
      sinon.assert.calledWith(res.status, 400);
    }
  });
  it('accepts absent and string pages in direct controller calls', async () => {
    for (const req of [{}, { query: { page: '2' } }]) {
      const res = { status: sinon.stub().returnsThis(), send: sinon.stub() };
      await controller.list(req, res);
      sinon.assert.notCalled(res.status);
      sinon.assert.calledOnce(res.send);
    }
  });
});

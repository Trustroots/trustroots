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
const controller: typeof import('../../server/controllers/admin.unsuspend.server.controller.mts') = require('../../server/controllers/admin.unsuspend.server.controller.mts');
interface Member {
  _id: import('mongoose').Types.ObjectId;
  roles: string[];
  authVersion?: number;
  public?: boolean;
  newsletter?: boolean;
  username: string;
  tagline?: string;
}
interface Audit {
  user: import('mongoose').Types.ObjectId;
  route: string;
  date: Date;
  body: { id: string; username: string; reason: string; outcome: string };
}
const User = mongoose.model<Member>('User');
const AuditLog = mongoose.model<Audit>('AuditLog');
const endpoint = '/api/admin/user/unsuspend';

describe('Administrator unsuspension', () => {
  let app: TestExpressApp;
  let agent: TestAgent;
  let raw: ReturnType<typeof utils.generateUsersWithSharedPassword>;
  let saved: Awaited<ReturnType<typeof utils.saveUsersWithCachedPasswords>>;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    raw = utils.generateUsersWithSharedPassword(3);
    raw[0].roles = ['user', 'admin'];
    raw[1].roles = ['user', 'suspended'];
    saved = await utils.saveUsersWithCachedPasswords(raw);
    agent = request.agent(app);
    await utils.signIn(raw[0], agent);
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });
  function payload() {
    return {
      id: String(saved[1]._id),
      confirmed: true,
      reason: '  Reviewed a fictional suspension.  ',
    };
  }

  it('preserves roles and all other member data, records the review and permits sign-in', async () => {
    await User.updateOne(
      { _id: saved[1]._id },
      {
        $set: {
          roles: ['user', 'suspended', 'volunteer'],
          public: false,
          newsletter: false,
          tagline: 'A fictional member note',
        },
      },
    );
    const memberAgent = request.agent(app);
    await memberAgent
      .post('/api/auth/signin')
      .send({ username: raw[1].username, password: raw[1].password })
      .expect(403);
    const before = (await User.findById(saved[1]._id).lean())!;
    const result = await agent
      .post(endpoint)
      .send({ ...payload(), roles: ['admin'], public: true, newsletter: true })
      .expect(200);
    assert.equal(result.body.changed, true);
    const after = (await User.findById(saved[1]._id).lean())!;
    assert.deepEqual(after.roles, ['user', 'volunteer']);
    assert.equal(after.authVersion, (before.authVersion || 0) + 1);
    assert.deepEqual(after, {
      ...before,
      roles: after.roles,
      authVersion: after.authVersion,
    });
    const audit = (await AuditLog.findOne({ route: endpoint }).lean())!;
    assert.equal(String(audit.user), String(saved[0]._id));
    assert.equal(audit.body.id, String(saved[1]._id));
    assert.equal(audit.body.username, before.username);
    assert.equal(audit.body.reason, 'Reviewed a fictional suspension.');
    assert.equal(audit.body.outcome, 'unsuspended');
    assert.ok(audit.date instanceof Date);
    await agent
      .post(endpoint)
      .send(payload())
      .expect(200)
      .then(response => assert.equal(response.body.changed, false));
    const repeated = (await User.findById(saved[1]._id).lean())!;
    assert.deepEqual(repeated, after);
    assert.equal(await AuditLog.countDocuments({ route: endpoint }), 1);
    await memberAgent
      .post('/api/auth/signin')
      .send({ username: raw[1].username, password: raw[1].password })
      .expect(200);
  });

  it('retains a shadow ban and other stored roles without restoring profile visibility', async () => {
    await User.collection.updateOne(
      { _id: saved[1]._id },
      {
        $set: {
          roles: ['user', 'suspended', 'shadowban', 'flagged'],
          public: false,
        },
      },
    );
    await agent.post(endpoint).send(payload()).expect(200);
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.deepEqual(member.roles, ['user', 'shadowban', 'flagged']);
    assert.equal(member.public, false);
  });

  it('supports legacy members without an authentication version', async () => {
    await User.collection.updateOne(
      { _id: saved[1]._id },
      { $unset: { authVersion: '' } },
    );
    await agent.post(endpoint).send(payload()).expect(200);
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.equal(member.authVersion, 1);
  });

  it('validates confirmation, IDs and the inclusive reason-length limit', async () => {
    await agent.post(endpoint).set('X-Trustroots-Request', '1').expect(400);
    for (const confirmed of [undefined, false, 'true', 1, {}, null]) {
      await agent
        .post(endpoint)
        .send({ ...payload(), confirmed })
        .expect(400);
    }
    for (const reason of [
      undefined,
      null,
      0,
      {},
      '',
      '   ',
      'x'.repeat(1001),
    ]) {
      await agent
        .post(endpoint)
        .send({ ...payload(), reason })
        .expect(400);
    }
    for (const id of [undefined, null, 0, {}, 'invalid']) {
      await agent
        .post(endpoint)
        .send({ ...payload(), id })
        .expect(400);
    }
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.ok(member.roles.includes('suspended'));
    assert.equal(await AuditLog.countDocuments({ route: endpoint }), 0);
    await agent
      .post(endpoint)
      .send({ ...payload(), reason: 'x'.repeat(1000) })
      .expect(200);
  });

  it('denies visitors and non-administrators, including direct controller calls', async () => {
    await request(app).post(endpoint).send(payload()).expect(403);
    await utils.signOut(agent);
    for (const roles of [
      ['user'],
      ['user', 'support-team'],
      ['user', 'welcome-team'],
    ]) {
      await User.updateOne({ _id: saved[2]._id }, { $set: { roles } });
      await utils.signIn(raw[2], agent);
      await agent.post(endpoint).send(payload()).expect(403);
      await utils.signOut(agent);
    }
    for (const req of [
      {},
      { user: { _id: saved[2]._id, roles: ['support-team'] } },
    ]) {
      const res = { status: sinon.stub().returnsThis(), send: sinon.stub() };
      await controller.unsuspendMember(req, res);
      sinon.assert.calledWith(res.status, 403);
    }
  });

  it('returns not-found and prevents using generic role removal to bypass a reason', async () => {
    await agent
      .post(endpoint)
      .send({ ...payload(), id: '000000000000000000000001' })
      .expect(404);
    await agent
      .post('/api/admin/user/change-role')
      .send({ id: saved[1]._id, role: 'suspended', action: 'remove' })
      .expect(400);
  });

  it('fails closed if audit intent cannot be stored', async () => {
    sinon
      .stub(AuditLog.prototype, 'save')
      .rejects(new Error('audit unavailable'));
    await agent.post(endpoint).send(payload()).expect(500);
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.ok(member.roles.includes('suspended'));
  });

  it('keeps durable intent if the member update fails', async () => {
    sinon.stub(User, 'updateOne').rejects(new Error('update unavailable'));
    await agent.post(endpoint).send(payload()).expect(500);
    const audit = (await AuditLog.findOne({ route: endpoint }).lean())!;
    assert.equal(audit.body.outcome, 'requested');
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.ok(member.roles.includes('suspended'));
  });

  it('keeps durable intent and gives a refresh error if outcome storage fails', async () => {
    const save = sinon.stub(AuditLog.prototype, 'save').callThrough();
    save.onSecondCall().rejects(new Error('outcome unavailable'));
    const response = await agent.post(endpoint).send(payload()).expect(500);
    assert.match(response.body.message, /Refresh the member report/);
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.ok(!member.roles.includes('suspended'));
    const audit = (await AuditLog.findOne({ route: endpoint }).lean())!;
    assert.equal(audit.body.reason, 'Reviewed a fictional suspension.');
    assert.equal(audit.body.outcome, 'requested');
  });

  it('rejects a stale snapshot, records the conflict and preserves the member', async () => {
    const update = sinon.stub(User, 'updateOne').resolves({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    });
    await agent.post(endpoint).send(payload()).expect(409);
    const query = update.firstCall.args[0] as unknown as {
      roles: string[];
      authVersion: number;
    };
    assert.deepEqual(query.roles, ['user', 'suspended']);
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.equal(query.authVersion, member.authVersion);
    assert.ok(member.roles.includes('suspended'));
    const audit = (await AuditLog.findOne({ route: endpoint }).lean())!;
    assert.equal(audit.body.outcome, 'conflict');
  });

  it('handles overlapping requests without repeated role or authentication changes', async () => {
    const before = (await User.findById(saved[1]._id).lean())!;
    const results = await Promise.all([
      agent.post(endpoint).send(payload()),
      agent.post(endpoint).send(payload()),
    ]);
    assert.ok(results.every(response => [200, 409].includes(response.status)));
    assert.equal(
      results.filter(response => response.body.changed === true).length,
      1,
    );
    const member = (await User.findById(saved[1]._id).lean())!;
    assert.deepEqual(member.roles, ['user']);
    assert.equal(member.authVersion, (before.authVersion || 0) + 1);
    assert.equal(
      await AuditLog.countDocuments({
        route: endpoint,
        'body.outcome': 'unsuspended',
      }),
      1,
    );
  });
});

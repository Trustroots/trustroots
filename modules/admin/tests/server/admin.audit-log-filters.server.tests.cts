const mongoose: typeof import('mongoose') = require('mongoose');
const sinon = require('sinon');
const should: typeof import('should') = require('should');
type AuditController =
  typeof import('../../server/controllers/admin.audit-log.server.controller.mts');
const controller: Pick<
  AuditController,
  'list' | 'actors'
> = require('../../server/controllers/admin.audit-log.server.controller.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type AuditLogRecord = {
  user: import('mongoose').Types.ObjectId;
  date?: Date;
  route?: string;
  body?: unknown;
  params?: unknown;
  query?: unknown;
  ip?: string;
};
type AuditHistoryItem = { user: { username: string } };
type HistoricalActor = { username: string; roles?: string[] };
type MockResponse = {
  code: number;
  body: unknown;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
};
const AuditLog = mongoose.model<AuditLogRecord>('AuditLog');
const User = mongoose.model<UserRecord>('User');
function response(): MockResponse {
  return {
    code: 200,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}
function historyBody(res: MockResponse): AuditHistoryItem[] {
  if (!Array.isArray(res.body)) throw new Error('Expected audit history array');
  if (!res.body.every(isAuditHistoryItem)) {
    throw new Error('Expected each history entry to have an actor username');
  }
  return res.body;
}
function actorsBody(res: MockResponse): HistoricalActor[] {
  if (!Array.isArray(res.body)) throw new Error('Expected actor array');
  if (!res.body.every(isHistoricalActor)) {
    throw new Error('Expected each actor to have a username and current roles');
  }
  return res.body;
}
function isAuditHistoryItem(item: unknown): item is AuditHistoryItem {
  if (typeof item !== 'object' || item === null || !('user' in item)) {
    return false;
  }
  const user = item.user;
  return (
    typeof user === 'object' &&
    user !== null &&
    'username' in user &&
    typeof user.username === 'string'
  );
}
function isHistoricalActor(actor: unknown): actor is HistoricalActor {
  return (
    typeof actor === 'object' &&
    actor !== null &&
    'username' in actor &&
    typeof actor.username === 'string' &&
    'roles' in actor &&
    Array.isArray(actor.roles) &&
    actor.roles.every(role => typeof role === 'string')
  );
}
describe('Audit history actor filters', () => {
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });
  it('filters history before limiting and intersects actor and current team', async () => {
    const members = utils.generateUsers(4);
    members[0].username = 'riveradmin';
    members[0].roles = ['user', 'admin'];
    members[1].username = 'forestwelcome';
    members[1].roles = ['user', 'welcome-team'];
    members[2].username = 'bothstaff';
    members[2].roles = ['user', 'admin', 'welcome-team'];
    const saved = await utils.saveUsers(members);
    await AuditLog.create([
      ...Array.from({ length: 101 }, (_, index) => ({
        user: saved[0]._id,
        date: new Date(2026, 0, index + 10),
        route: '/api/admin/users',
      })),
      {
        user: saved[1]._id,
        date: new Date('2025-01-01'),
        route: '/api/admin/acquisition-stories',
      },
      {
        user: saved[2]._id,
        date: new Date('2025-01-02'),
        route: '/api/admin/users',
      },
      {
        user: saved[3]._id,
        date: new Date('2025-01-03'),
        route: '/api/admin/users',
      },
    ]);
    const res = response();
    await controller.list({ query: { team: 'welcome-team' } }, res);
    historyBody(res)
      .map(item => item.user.username)
      .should.eql(['bothstaff', 'forestwelcome']);
    await controller.list({ query: { username: '  FORESTWELCOME  ' } }, res);
    historyBody(res).length.should.equal(1);
    await controller.list(
      { query: { username: 'forestwelcome', team: 'admin' } },
      res,
    );
    should(res.body).eql([]);
    await controller.list(
      { query: { username: 'bothstaff', team: 'admin' } },
      res,
    );
    historyBody(res).length.should.equal(1);
    await controller.list({ query: { team: 'admin' } }, res);
    historyBody(res).length.should.equal(100);
    historyBody(res)
      .every(item => item.user.username === 'riveradmin')
      .should.be.true();
    await controller.list({ query: { username: 'missingstaff' } }, res);
    should(res.body).eql([]);
    await User.updateOne(
      { _id: saved[1]._id },
      { $pull: { roles: 'welcome-team' } },
    );
    await controller.list(
      { query: { username: 'forestwelcome', team: 'welcome-team' } },
      res,
    );
    should(res.body).eql([]);
  });
  it('rejects unsupported teams and non-string filters', async () => {
    for (const query of [
      { team: 'unknown' },
      { username: ['river'] },
      { team: ['admin'] },
    ]) {
      const res = response();
      await controller.list({ query }, res);
      res.code.should.equal(400);
    }
  });
  it('reports a failed actor lookup', async () => {
    sinon.stub(User, 'find').returns({
      select: () => ({
        lean: async () => {
          throw new Error('Actor lookup failed');
        },
      }),
    });
    const res = response();
    await controller.list({ query: { username: 'river' } }, res);
    res.code.should.equal(400);
  });
  it('lists historical actors with current roles and no sensitive fields', async () => {
    const members = utils.generateUsers(3);
    members[0].username = 'riveradmin';
    members[0].roles = ['user', 'admin'];
    members[1].username = 'forestwelcome';
    members[1].roles = ['user', 'welcome-team'];
    const saved = await utils.saveUsers(members);
    await AuditLog.create([
      { user: saved[0]._id },
      { user: saved[0]._id },
      { user: saved[1]._id },
      { user: new mongoose.Types.ObjectId() },
    ]);
    const res = response();
    await controller.actors({}, res);
    actorsBody(res)
      .map(actor => actor.username)
      .should.eql(['forestwelcome', 'riveradmin']);
    actorsBody(res)[0].roles?.should.containEql('welcome-team');
    should(actorsBody(res)[0]).not.have.property('password');
  });
  it('returns no actor options without history', async () => {
    const res = response();
    await controller.actors({}, res);
    should(res.body).eql([]);
  });
  it('reports failed history lookups', async () => {
    sinon
      .stub(AuditLog, 'distinct')
      .rejects(new Error('History lookup failed'));
    const res = response();
    await controller.actors({}, res);
    res.code.should.equal(400);
  });
});

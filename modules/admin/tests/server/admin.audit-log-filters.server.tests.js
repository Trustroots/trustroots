const mongoose = require('mongoose');
const sinon = require('sinon');
require('should');
const controller = require('../../server/controllers/admin.audit-log.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
const AuditLog = mongoose.model('AuditLog');
const User = mongoose.model('User');
function response() {
  return {
    code: 200,
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
    res.body
      .map(item => item.user.username)
      .should.eql(['bothstaff', 'forestwelcome']);
    await controller.list({ query: { username: '  FORESTWELCOME  ' } }, res);
    res.body.length.should.equal(1);
    await controller.list(
      { query: { username: 'forestwelcome', team: 'admin' } },
      res,
    );
    res.body.should.eql([]);
    await controller.list(
      { query: { username: 'bothstaff', team: 'admin' } },
      res,
    );
    res.body.length.should.equal(1);
    await controller.list({ query: { team: 'admin' } }, res);
    res.body.length.should.equal(100);
    res.body
      .every(item => item.user.username === 'riveradmin')
      .should.be.true();
    await controller.list({ query: { username: 'missingstaff' } }, res);
    res.body.should.eql([]);
    await User.updateOne(
      { _id: saved[1]._id },
      { $pull: { roles: 'welcome-team' } },
    );
    await controller.list(
      { query: { username: 'forestwelcome', team: 'welcome-team' } },
      res,
    );
    res.body.should.eql([]);
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
    res.body
      .map(actor => actor.username)
      .should.eql(['forestwelcome', 'riveradmin']);
    res.body[0].roles.should.containEql('welcome-team');
    res.body[0].should.not.have.property('password');
  });
  it('returns no actor options without history', async () => {
    const res = response();
    await controller.actors({}, res);
    res.body.should.eql([]);
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

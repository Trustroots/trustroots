const request = require('supertest');
const mongoose = require('mongoose');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
describe('Admin Audit Log CRUD tests', () => {
  // Get application
  let app;
  let agent;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  const _users = utils.generateUsers(2);
  _users[0].roles = ['user', 'admin'];
  beforeEach(async () => {
    await utils.saveUsers(_users);
  });
  afterEach(utils.clearDatabase);
  describe('Search users', () => {
    it('non-authenticated users should not be allowed to read audit log', done => {
      agent.get('/api/admin/audit-log').expect(403).end(done);
    });
    it('non-admin users should not be allowed to read audit log', done => {
      agent
        .post('/api/auth/signin')
        .send(_users[1])
        .expect(200)
        .end(() => {
          agent.get('/api/admin/audit-log').expect(403).end(done);
        });
    });
    it('admin users should be allowed to read audit log', async () => {
      await utils.signInPrivileged(_users[0], agent);
      await agent.get('/api/admin/audit-log').expect(200);
    });
  });
});

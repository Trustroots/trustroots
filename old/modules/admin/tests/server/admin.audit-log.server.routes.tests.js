const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

describe('Admin Audit Log CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

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

    it('admin users should be allowed to read audit log', done => {
      agent
        .post('/api/auth/signin')
        .send(_users[0])
        .expect(200)
        .end(() => {
          agent.get('/api/admin/audit-log').expect(200).end(done);
        });
    });
  });
});

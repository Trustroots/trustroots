const mongoose = require('mongoose');
const request = require('supertest');
require('should');

const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');

describe('Admin access route tests', () => {
  const app = express.init(mongoose.connection);

  const _usersRaw = utils.generateUsers(3);
  _usersRaw[0].roles = ['user'];
  _usersRaw[1].roles = ['user'];
  _usersRaw[2].roles = ['user'];

  let targetUserId;

  const credentialsRegular = {
    username: _usersRaw[0].username,
    password: _usersRaw[0].password,
  };

  const credentialsSecondRegular = {
    username: _usersRaw[1].username,
    password: _usersRaw[1].password,
  };

  const adminRequests = () => [
    {
      method: 'post',
      path: '/api/admin/acquisition-stories',
    },
    {
      method: 'post',
      path: '/api/admin/acquisition-stories/analysis',
    },
    {
      method: 'get',
      path: '/api/admin/audit-log',
    },
    {
      method: 'get',
      path: '/api/admin/dashboard',
    },
    {
      method: 'post',
      path: '/api/admin/messages',
      body: { user1: targetUserId, user2: targetUserId },
    },
    {
      method: 'post',
      path: '/api/admin/threads',
      body: { userId: targetUserId },
    },
    {
      method: 'get',
      path: `/api/admin/notes?userId=${targetUserId}`,
    },
    {
      method: 'post',
      path: '/api/admin/notes',
      body: { userId: targetUserId, note: 'test' },
    },
    {
      method: 'post',
      path: '/api/admin/users',
      body: { search: _usersRaw[2].username },
    },
    {
      method: 'post',
      path: '/api/admin/users/by-role',
      body: { role: 'admin' },
    },
    {
      method: 'post',
      path: '/api/admin/user',
      body: { id: targetUserId },
    },
    {
      method: 'post',
      path: '/api/admin/user/change-role',
      body: { id: targetUserId, role: 'suspended' },
    },
    {
      method: 'get',
      path: '/api/admin/reference-threads',
    },
  ];

  async function expectAdminRequestsForbidden(agent) {
    for (const adminRequest of adminRequests()) {
      let pendingRequest = agent[adminRequest.method](adminRequest.path);

      if (adminRequest.body) {
        pendingRequest = pendingRequest.send(adminRequest.body);
      }

      const { body } = await pendingRequest.expect(403);
      body.message.should.equal('Forbidden.');
    }
  }

  beforeEach(async () => {
    const users = await utils.saveUsers(_usersRaw);
    targetUserId = users[2]._id.toString();
  });

  afterEach(utils.clearDatabase);

  it('does not allow guests to use admin endpoints', async () => {
    await expectAdminRequestsForbidden(request.agent(app));
  });

  it('does not allow regular users to use admin endpoints', async () => {
    const agent = request.agent(app);
    await utils.signIn(credentialsRegular, agent);

    await expectAdminRequestsForbidden(agent);
  });

  it('does not allow another regular user to use admin endpoints', async () => {
    const agent = request.agent(app);
    await utils.signIn(credentialsSecondRegular, agent);

    await expectAdminRequestsForbidden(agent);
  });
});

const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const mfaService = require('../../../users/server/services/mfa.server.service.mjs');
require('should');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
describe('Admin access route tests', () => {
  let app;
  before(async function () {
    app = await express.init(mongoose.connection);
  });
  let _usersRaw;
  let targetUserId;
  let credentialsRegular;
  let credentialsSecondRegular;
  const adminRequests = () => [
    {
      method: 'get',
      path: '/api/admin/staff-blockers',
    },
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
      path: '/api/admin/audit-log/actors',
    },
    {
      method: 'get',
      path: '/api/admin/dashboard',
    },
    {
      method: 'post',
      path: '/api/admin/messages',
      body: {
        user1: targetUserId,
        user2: targetUserId,
      },
    },
    {
      method: 'post',
      path: '/api/admin/messages/scammer-recipients',
      body: {
        username: _usersRaw[2].username,
      },
    },
    {
      method: 'post',
      path: '/api/admin/messages/scammer-warning',
      body: {
        username: _usersRaw[2].username,
        content: 'Warning',
      },
    },
    {
      method: 'post',
      path: '/api/admin/threads',
      body: {
        userId: targetUserId,
      },
    },
    {
      method: 'get',
      path: `/api/admin/notes?userId=${targetUserId}`,
    },
    {
      method: 'post',
      path: '/api/admin/notes',
      body: {
        userId: targetUserId,
        note: 'test',
      },
    },
    {
      method: 'post',
      path: '/api/admin/users',
      body: {
        search: _usersRaw[2].username,
      },
    },
    {
      method: 'post',
      path: '/api/admin/users/by-role',
      body: {
        role: 'admin',
      },
    },
    {
      method: 'post',
      path: '/api/admin/user',
      body: {
        id: targetUserId,
      },
    },
    {
      method: 'post',
      path: '/api/admin/user/change-role',
      body: {
        id: targetUserId,
        role: 'suspended',
      },
    },
    {
      method: 'get',
      path: '/api/admin/reference-threads',
    },
  ];
  async function expectAdminRequestsForbidden(agent) {
    for (const adminRequest of adminRequests()) {
      let pendingRequest = agent[adminRequest.method](adminRequest.path);
      if (adminRequest.method !== 'get') {
        pendingRequest = pendingRequest.set('X-Trustroots-Request', '1');
      }
      if (adminRequest.body) {
        pendingRequest = pendingRequest.send(adminRequest.body);
      }
      const { body } = await pendingRequest.expect(403);
      body.message.should.equal('Forbidden.');
    }
  }
  function currentTotp(secret) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const character of secret) {
      value = (value << 5) | alphabet.indexOf(character);
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    const counter = Math.floor(Date.now() / 1000 / 30);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
    const digest = crypto
      .createHmac('sha1', Buffer.from(bytes))
      .update(counterBuffer)
      .digest();
    const offset = digest[digest.length - 1] & 15;
    return String(
      (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000,
    ).padStart(6, '0');
  }
  beforeEach(async () => {
    _usersRaw = utils.generateUsers(3);
    _usersRaw.forEach(user => {
      user.roles = ['user'];
      user.username = 'mfa-test-member';
      user.email = 'mfa-test-member@example.test';
      user.password = 'ExamplePassword123!';
    });
    _usersRaw[1].username = 'mfa-test-second';
    _usersRaw[1].email = 'mfa-test-second@example.test';
    _usersRaw[2].username = 'mfa-test-target';
    _usersRaw[2].email = 'mfa-test-target@example.test';
    credentialsRegular = {
      username: _usersRaw[0].username,
      password: _usersRaw[0].password,
    };
    credentialsSecondRegular = {
      username: _usersRaw[1].username,
      password: _usersRaw[1].password,
    };
    const users = await utils.saveUsers(_usersRaw);
    targetUserId = users[2]._id.toString();
  });
  afterEach(utils.clearDatabase);
  it('allows welcome-team acquisition access only after MFA, and honours revocation', async () => {
    const User = mongoose.model('User');
    await User.updateOne(
      {
        username: credentialsRegular.username,
      },
      {
        $addToSet: {
          roles: 'welcome-team',
        },
      },
    );
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    await User.updateOne(
      { username: credentialsRegular.username },
      {
        $set: {
          mfaEnabled: true,
          mfaSecretEncrypted: mfaService.encryptSecret(secret),
          mfaLastTotpCounter: -1,
        },
      },
    );
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send(credentialsRegular).expect(202);
    await agent
      .post('/api/auth/mfa/verify')
      .set('X-Trustroots-Request', '1')
      .send({ code: currentTotp(secret) })
      .expect(200);
    for (const endpoint of adminRequests()) {
      const expected =
        endpoint.path.startsWith('/api/admin/acquisition-stories') ||
        endpoint.path === '/api/admin/staff-blockers'
          ? 200
          : 403;
      const response = await agent[endpoint.method](endpoint.path).send(
        endpoint.body || {},
      );
      if (response.status !== expected) {
        throw new Error(
          `${endpoint.path}: expected ${expected}, received ${
            response.status
          } ${JSON.stringify(response.body)}`,
        );
      }
    }
    await User.updateOne(
      {
        username: credentialsRegular.username,
      },
      {
        $pull: {
          roles: 'welcome-team',
        },
      },
    );
    await expectAdminRequestsForbidden(agent);
  });
  it('requires administrators to enrol MFA before account access', async () => {
    const User = mongoose.model('User');
    const credentials = {
      username: 'mfa-admin-test',
      password: 'ExamplePassword123!',
    };
    await new User({
      ...credentials,
      firstName: 'Example',
      lastName: 'Member',
      email: 'mfa-admin@example.test',
      provider: 'local',
      roles: ['user', 'admin'],
    }).save();
    const agent = request.agent(app);
    await utils.signIn(credentials, agent);
    const blocked = await agent.get('/api/admin/dashboard').expect(403);
    blocked.body.mfaRequired.should.be.true();
    const enrolment = await agent
      .post('/api/users/mfa/enrol')
      .set('X-Trustroots-Request', '1')
      .send({ currentPassword: credentials.password })
      .expect(200);
    const secret = new URL(enrolment.body.provisioningUri).searchParams.get(
      'secret',
    );
    const activation = await agent
      .post('/api/users/mfa/enrol/verify')
      .set('X-Trustroots-Request', '1')
      .send({ code: currentTotp(secret) })
      .expect(200);
    activation.body.recoveryCodes.should.have.length(10);
    activation.body.user.should.not.have.property('mfaSecretEncrypted');
    await agent.get('/api/admin/dashboard').expect(200);
  });
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

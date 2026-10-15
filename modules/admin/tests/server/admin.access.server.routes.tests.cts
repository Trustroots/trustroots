import type {
  TestExpressApp,
  TestAgent,
} from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const crypto: typeof import('node:crypto') = require('node:crypto');
const mfaService = require('../../../users/server/services/mfa.server.service.mjs');
require('should');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mjs') = require('../../../../testutils/server/data.server.testutil');
describe('Admin access route tests', () => {
  let app: TestExpressApp;
  before(async function () {
    app = await express.init(mongoose.connection);
  });
  let _usersRaw = utils.generateUsers(3);
  _usersRaw[0].roles = ['user'];
  _usersRaw[1].roles = ['user'];
  _usersRaw[2].roles = ['user'];
  let targetUserId = '';
  let credentialsRegular = {
    username: _usersRaw[0].username,
    password: _usersRaw[0].password,
  };
  let credentialsSecondRegular = {
    username: _usersRaw[1].username,
    password: _usersRaw[1].password,
  };
  type AdminRequest = { method: 'get' | 'post'; path: string; body?: object };
  const adminRequests = (): AdminRequest[] => [
    {
      method: 'get',
      path: '/api/admin/location-corrections',
    },
    {
      method: 'post',
      path: '/api/admin/location-corrections/send',
      body: {},
    },
    {
      method: 'get',
      path: '/api/admin/staff-blockers',
    },
    {
      method: 'post',
      path: '/api/admin/acquisition-stories',
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
  function sendAdminRequest(agent: TestAgent, endpoint: AdminRequest) {
    return endpoint.method === 'get'
      ? agent.get(endpoint.path)
      : agent.post(endpoint.path);
  }
  async function expectAdminRequestsForbidden(agent: TestAgent) {
    for (const adminRequest of adminRequests()) {
      let pendingRequest = sendAdminRequest(agent, adminRequest);
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
  function currentTotp(secret: string) {
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
      user.username = 'mfatestmember';
      user.email = 'mfatestmember@example.test';
      user.password = 'ExamplePassword123!';
    });
    _usersRaw[1].username = 'mfatestsecond';
    _usersRaw[1].email = 'mfatestsecond@example.test';
    _usersRaw[2].username = 'mfatesttarget';
    _usersRaw[2].email = 'mfatesttarget@example.test';
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
      .send({ code: currentTotp(secret!) })
      .expect(200);
    await utils.elevateAdminAccess(agent, credentialsRegular.password);
    for (const endpoint of adminRequests()) {
      const expected =
        endpoint.path.startsWith('/api/admin/acquisition-stories') ||
        endpoint.path === '/api/admin/staff-blockers' ||
        endpoint.path === '/api/admin/location-corrections'
          ? 200
          : endpoint.path === '/api/admin/location-corrections/send'
            ? 400
            : 403;
      const pendingRequest = sendAdminRequest(agent, endpoint);
      await pendingRequest.send(endpoint.body || {}).expect(expected);
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
      username: 'mfaadmintest',
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
    await agent.post('/api/auth/signin').send(credentials).expect(200);
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
      .send({ code: currentTotp(secret!) })
      .expect(200);
    activation.body.recoveryCodes.should.have.length(10);
    activation.body.user.should.not.have.property('mfaSecretEncrypted');
    const elevationRequired = await agent
      .get('/api/admin/dashboard')
      .expect(403);
    elevationRequired.body.code.should.equal('ADMIN_ELEVATION_REQUIRED');
    await utils.elevateAdminAccess(agent, credentials.password);
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

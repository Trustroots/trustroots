const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sinon = require('sinon');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express.mjs');
const config = require('../../../../config/config.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const mfa = require('../../server/services/mfa.server.service.mjs').default;
const {
  hashToken,
} = require('../../server/services/action-token.server.service.mjs');
const User = mongoose.model('User');
const MemberSession = mongoose.model('MemberSession');

describe('Combined account access flows', function () {
  let app;
  let user;
  const password = 'FictionalPassword123!';
  const recovery = 'A1B2C3D4E5F60718';
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    user = await User.create({
      firstName: 'Fictional',
      lastName: 'Member',
      username: 'combined-member',
      email: 'combined-member@example.test',
      password,
      public: true,
      roles: ['user'],
      mfaEnabled: true,
      mfaSecretEncrypted: mfa.encryptSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'),
      mfaRecoveryCodeHashes: [mfa.hashRecoveryCode(recovery)],
    });
  });
  afterEach(() => sinon.restore());
  afterEach(utils.clearDatabase);
  const signin = agent =>
    agent
      .post('/api/auth/signin')
      .send({ username: 'combined-member', password });
  async function authenticate(agent) {
    await signin(agent).expect(202);
    await agent
      .post('/api/auth/mfa/verify')
      .send({ code: recovery })
      .expect(200);
    await agent.get('/api/auth/session').expect(200);
  }
  function solve(challenge) {
    for (let solution = 0; solution <= 4194304; solution++) {
      const hash = crypto
        .createHash('sha256')
        .update(challenge.token + ':' + solution)
        .digest();
      if (hash[0] === 0 && (hash[1] & 252) === 0)
        return { token: challenge.token, solution };
    }
    throw new Error('Could not solve fixture challenge.');
  }
  async function requireProof() {
    const windowStart = Math.floor(Date.now() / 900000) * 900000;
    const key = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(
        JSON.stringify([
          'signin-account',
          'account',
          user.username,
          windowStart,
        ]),
      )
      .digest('hex');
    await mongoose
      .model('RequestLimit')
      .create({ key, count: 20, expiresAt: new Date(windowStart + 900000) });
  }
  it('consumes one account proof and one recovery factor across concurrent sign-in requests', async () => {
    await requireProof();
    const first = request.agent(app);
    const second = request.agent(app);
    const challenged = await signin(first).expect(429);
    const signinProof = solve(challenged.body.signinChallenge);
    const attempts = await Promise.all(
      [first, second].map(agent =>
        agent
          .post('/api/auth/signin')
          .send({ username: user.username, password, signinProof }),
      ),
    );
    assert.deepEqual(attempts.map(result => result.status).sort(), [202, 429]);
    const accepted = attempts[0].status === 202 ? first : second;
    assert.equal((await accepted.get('/api/auth/session')).body.userId, null);
    await accepted.get('/api/auth/sessions').expect(403);
    const factors = await Promise.all(
      [1, 2].map(() =>
        accepted.post('/api/auth/mfa/verify').send({ code: recovery }),
      ),
    );
    assert.deepEqual(factors.map(result => result.status).sort(), [200, 400]);
    await accepted.get('/api/auth/session').expect(200);
    assert.equal(
      await MemberSession.countDocuments({ user: user._id, revoked: false }),
      1,
    );
    await accepted
      .post('/api/auth/mfa/verify')
      .send({ code: recovery })
      .expect(401);
  });
  it('consumes a reset once, revokes existing sessions and requires fresh MFA', async () => {
    const signedIn = request.agent(app);
    await authenticate(signedIn);
    const token = 'a'.repeat(40);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: hashToken(token),
          resetPasswordExpires: new Date(Date.now() + 60000),
        },
      },
    );
    const attempts = await Promise.all(
      [request.agent(app), request.agent(app)].map(agent =>
        agent.post('/api/auth/reset/' + token).send({
          newPassword: 'UpdatedFictionalPassword123!',
          verifyPassword: 'UpdatedFictionalPassword123!',
        }),
      ),
    );
    assert.deepEqual(attempts.map(result => result.status).sort(), [200, 400]);
    assert.equal(
      attempts.find(result => result.status === 200).body.mfaRequired,
      true,
    );
    assert.equal((await signedIn.get('/api/auth/session')).body.userId, null);
    const updated = await User.findById(user._id)
      .select('+resetPasswordToken')
      .lean();
    assert.equal(updated.authVersion, 1);
    assert.equal(updated.resetPasswordToken, undefined);
    assert.equal(updated.mfaEnabled, true);
    const native = request.agent(app);
    await native
      .post('/api/auth/signin')
      .set('User-Agent', 'FictionalNativeClient/1.0')
      .send({
        username: user.username,
        password: 'UpdatedFictionalPassword123!',
      })
      .expect(202);
    assert.equal((await native.get('/api/auth/session')).body.userId, null);
    await native.get('/api/auth/sessions').expect(403);
  });
  it('does not start an idle lifetime at the first later authenticated request', async () => {
    await User.updateOne({ _id: user._id }, { $set: { mfaEnabled: false } });
    const agent = request.agent(app);
    await signin(agent).expect(200);
    assert.equal(await MemberSession.countDocuments(), 0);
    const now = Date.now();
    sinon.stub(Date, 'now').returns(now + 8 * 86400000);
    assert.equal((await agent.get('/api/auth/session')).body.userId, null);
  });
  it('revokes all verified sessions and leaves a staged MFA challenge unusable', async () => {
    const active = request.agent(app);
    const staged = request.agent(app);
    await authenticate(active);
    await signin(staged).expect(202);
    await active.delete('/api/auth/sessions').send({ password }).expect(204);
    assert.equal((await active.get('/api/auth/session')).body.userId, null);
    await staged
      .post('/api/auth/mfa/verify')
      .send({ code: recovery })
      .expect(401);
    assert.equal((await staged.get('/api/auth/session')).body.userId, null);
  });
  it('keeps email confirmation separate from second-factor verification', async () => {
    const token = 'b'.repeat(40);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          emailTemporary: 'combined-new@example.test',
          emailToken: hashToken(token),
        },
      },
    );
    const agent = request.agent(app);
    await agent.get('/api/auth/confirm-email/' + token).expect(302);
    assert.equal((await User.findById(user._id)).email, user.email);
    const result = await agent
      .post('/api/auth/confirm-email/' + token)
      .send({})
      .expect(200);
    assert.equal(result.body.mfaRequired, true);
    assert.equal((await agent.get('/api/auth/session')).body.userId, null);
    await agent.get('/api/auth/sessions').expect(403);
    assert.equal(
      (await User.findById(user._id)).email,
      'combined-new@example.test',
    );
  });
});

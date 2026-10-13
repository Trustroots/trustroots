const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sinon = require('sinon');
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('../../../../config/lib/express.mjs');
const config = require('../../../../config/config.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const service = require('../../server/services/passkey.server.service.mjs');
const User = mongoose.model('User');
const Ceremony = mongoose.model('PasskeyCeremony');
const Key = mongoose.model('MemberPasskey');

describe('Passkey database and route integration', function () {
  let app;
  let user;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    user = await User.create({
      firstName: 'Fictional',
      lastName: 'Member',
      username: 'fictional-staff',
      email: 'fictional-staff@example.test',
      password: 'FictionalPassword123!',
      roles: ['user', 'admin'],
      mfaEnabled: true,
    });
    user.$locals.mfaVerified = true;
  });
  afterEach(() => sinon.restore());
  afterEach(utils.clearDatabase);
  function req(sessionID = 'fictional-session') {
    return {
      user,
      sessionID,
      body: {
        ceremonyId: 'fictional-ceremony',
        response: { id: 'fictional-key' },
      },
    };
  }
  async function ceremony() {
    await Ceremony.create({
      _id: 'fictional-ceremony',
      user: user._id,
      session: crypto
        .createHmac('sha256', config.sessionSecret)
        .update('passkey-session:fictional-session')
        .digest('hex'),
      authVersion: 0,
      type: 'registration',
      challenge: 'fictional-challenge',
      userHandle: 'opaque',
      label: 'Laptop',
      expiresAt: new Date(Date.now() + 300000),
    });
    sinon.stub(service.webauthn, 'verifyRegistrationResponse').resolves({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'fictional-key',
          publicKey: new Uint8Array([1, 2]),
          counter: 0,
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    });
  }
  it('consumes one registration ceremony once under concurrent submissions', async () => {
    await ceremony();
    const results = await Promise.allSettled([
      service.register(req()),
      service.register(req()),
    ]);
    assert.equal(
      results.filter(result => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(await Key.countDocuments({ user: user._id }), 1);
    assert.equal(await Ceremony.countDocuments(), 0);
    await assert.rejects(service.register(req()), /expired/);
  });
  it('does not consume an owner ceremony from another session or changed auth version', async () => {
    await ceremony();
    await assert.rejects(service.register(req('different-session')), /expired/);
    assert.equal(await Ceremony.countDocuments(), 1);
    await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
    await assert.rejects(service.register(req()), /Sign in again/);
    assert.equal(service.webauthn.verifyRegistrationResponse.callCount, 0);
  });
  it('rejects an expired ceremony without invoking the verifier', async () => {
    await ceremony();
    await Ceremony.updateOne({}, { $set: { expiresAt: new Date(0) } });
    await assert.rejects(service.register(req()), /expired/);
    assert.equal(service.webauthn.verifyRegistrationResponse.callCount, 0);
  });
  it('cleans credentials and outstanding ceremonies when an account is removed', async () => {
    await ceremony();
    await service.register(req());
    await User.findOneAndRemove({ _id: user._id });
    assert.equal(await Key.countDocuments({ user: user._id }), 0);
    assert.equal(await Ceremony.countDocuments({ user: user._id }), 0);
    await User.findOneAndRemove({ _id: user._id });
  });
  it('keeps credential routes private and authentication routes staged', async () => {
    await request(app).get('/api/users/passkeys').expect(403);
    await request(app)
      .post('/api/users/passkeys/register/options')
      .send({})
      .expect(403);
    await request(app)
      .post('/api/users/passkeys/register/verify')
      .send({})
      .expect(403);
    await request(app)
      .delete('/api/users/passkeys/fictional-key')
      .send({})
      .expect(403);
    await request(app).post('/api/auth/passkeys/options').send({}).expect(401);
    await request(app).post('/api/auth/passkeys/verify').send({}).expect(401);
  });
});

const assert = require('node:assert/strict');
const sinon = require('sinon');
const mongoose = require('mongoose');
const config = require('../../../../../config/config.mts');
const mfa = require('../../../server/services/mfa.server.service.mjs').default;
const service = require('../../../server/services/passkey.server.service.mjs');
const { webauthn } = service;
const User = mongoose.model('User');
const Key = mongoose.model('MemberPasskey');
const Ceremony = mongoose.model('PasskeyCeremony');

describe('Staff passkey ceremonies', function () {
  let user;
  let req;
  let keys;
  let ceremony;
  let key;
  beforeEach(function () {
    user = {
      _id: new mongoose.Types.ObjectId(),
      id: 'fictional-member',
      username: 'fictional-member',
      roles: ['user', 'admin'],
      mfaEnabled: true,
      authVersion: 0,
      $locals: { mfaVerified: true },
      authenticate: sinon.stub().resolves(true),
    };
    req = {
      user,
      sessionID: 'fictional-session',
      session: { mfaChallenge: mfa.createChallenge(user) },
      body: {
        currentPassword: 'fictional-password',
        code: '123456',
        label: 'Laptop',
        ceremonyId: 'fictional-ceremony',
        response: { id: 'fictional-key' },
      },
      params: { id: 'fictional-key' },
    };
    keys = [];
    ceremony = {
      challenge: 'expected-challenge',
      userHandle: 'opaque',
      label: 'Laptop',
    };
    key = {
      id: 'fictional-key',
      label: 'Laptop',
      user: user._id,
      publicKey: Buffer.from([1, 2]),
      counter: 1,
      transports: ['internal'],
      createdAt: new Date(),
    };
    sinon
      .stub(config, 'passkeys')
      .value({ rpId: 'localhost', origins: ['http://localhost:4300'] });
    sinon.stub(User, 'findById').resolves(user);
    sinon.stub(User, 'findOne').resolves(user);
    sinon.stub(mfa, 'verifyAndConsume').resolves({ user });
    sinon.stub(Key, 'find').callsFake(() => ({
      then: resolve => Promise.resolve(keys).then(resolve),
      sort: async () => keys,
    }));
    sinon.stub(Key, 'findOne').returns({ select: async () => key });
    sinon.stub(Key, 'create').resolves(key);
    sinon.stub(Key, 'findOneAndUpdate').resolves(key);
    sinon.stub(Key, 'findOneAndDelete').resolves(key);
    sinon.stub(Ceremony, 'create').resolves({});
    sinon.stub(Ceremony, 'findOneAndDelete').resolves(ceremony);
    sinon
      .stub(webauthn, 'generateRegistrationOptions')
      .resolves({ challenge: 'expected-challenge' });
    sinon
      .stub(webauthn, 'generateAuthenticationOptions')
      .resolves({ challenge: 'expected-challenge' });
    sinon.stub(webauthn, 'verifyRegistrationResponse').resolves({
      verified: true,
      registrationInfo: {
        credential: {
          id: key.id,
          publicKey: new Uint8Array([1, 2]),
          counter: 0,
          transports: ['internal'],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    });
    sinon.stub(webauthn, 'verifyAuthenticationResponse').resolves({
      verified: true,
      authenticationInfo: { newCounter: 2, credentialBackedUp: false },
    });
  });
  afterEach(() => sinon.restore());

  it('binds registration options to a configured site, verified member and session', async function () {
    const result = await service.registrationOptions(req);
    assert.match(result.ceremonyId, /^[a-f0-9]{64}$/);
    const options = webauthn.generateRegistrationOptions.firstCall.args[0];
    assert.equal(options.rpID, 'localhost');
    assert.equal(options.authenticatorSelection.userVerification, 'required');
    assert.equal(options.attestationType, 'none');
    const saved = Ceremony.create.firstCall.args[0];
    assert.notEqual(saved.session, req.sessionID);
    assert.equal(saved.authVersion, 0);
    assert.equal(saved.type, 'registration');
    keys.push(key);
    await service.registrationOptions(req);
    assert.deepEqual(
      webauthn.generateRegistrationOptions.secondCall.args[0].userID,
      options.userID,
    );
    assert.equal(
      webauthn.generateRegistrationOptions.secondCall.args[0]
        .excludeCredentials[0].id,
      key.id,
    );
  });
  it('stores only verified registration material and consumes the bound ceremony', async function () {
    assert.deepEqual(await service.register(req), { registered: true });
    const query = Ceremony.findOneAndDelete.firstCall.args[0];
    assert.equal(query.user, user._id);
    assert.equal(query.type, 'registration');
    assert.equal(query.authVersion, 0);
    assert(query.expiresAt.$gt instanceof Date);
    assert.equal(
      webauthn.verifyRegistrationResponse.firstCall.args[0]
        .requireUserVerification,
      true,
    );
    assert.equal(
      Key.create.firstCall.args[0].publicKey.toString('hex'),
      '0102',
    );
    Ceremony.findOneAndDelete.resolves(null);
    await assert.rejects(service.register(req), /expired/);
  });
  it('lists only display metadata for the owner and removes a confirmed key', async function () {
    keys.push(key);
    assert.deepEqual(await service.list(req), [
      {
        id: key.id,
        label: key.label,
        createdAt: key.createdAt,
        lastUsedAt: undefined,
      },
    ]);
    assert.deepEqual(Key.find.firstCall.args[0], { user: user._id });
    assert.deepEqual(await service.remove(req), { removed: true });
    assert.deepEqual(Key.findOneAndDelete.firstCall.args[0], {
      _id: key.id,
      user: user._id,
    });
    Key.findOneAndDelete.resolves(null);
    await assert.rejects(service.remove(req), /not found/);
  });
  it('requires a password-stage challenge and atomically advances the stored counter', async function () {
    keys.push(key);
    await service.authenticationOptions(req);
    assert.equal(
      webauthn.generateAuthenticationOptions.firstCall.args[0].userVerification,
      'required',
    );
    assert.equal(await service.authenticate(req), user);
    assert.equal(user.$locals.mfaVerified, true);
    assert.equal(req.session.mfaChallenge, undefined);
    assert.deepEqual(Key.findOneAndUpdate.firstCall.args[0], {
      _id: key.id,
      user: user._id,
      counter: 1,
    });
    assert.equal(Key.findOneAndUpdate.firstCall.args[1].$set.counter, 2);
    assert.equal(
      webauthn.verifyAuthenticationResponse.firstCall.args[0].expectedRPID,
      'localhost',
    );
    assert.deepEqual(
      webauthn.verifyAuthenticationResponse.firstCall.args[0].expectedOrigin,
      ['http://localhost:4300'],
    );
  });
  it('rejects missing deployment configuration', async function () {
    for (const settings of [
      {},
      { rpId: 'localhost' },
      { rpId: 'localhost', origins: [] },
    ]) {
      config.passkeys = settings;
      await assert.rejects(service.registrationOptions(req), /not configured/);
    }
  });
  it('rejects unverified and ordinary members at management entry points', async function () {
    for (const change of [
      () => {
        req.user = null;
      },
      () => {
        user.roles = ['user'];
      },
      () => {
        user.mfaEnabled = false;
      },
      () => {
        user.$locals.mfaVerified = false;
      },
    ]) {
      const saved = {
        roles: user.roles,
        mfaEnabled: user.mfaEnabled,
        $locals: { ...user.$locals },
      };
      change();
      await assert.rejects(service.registrationOptions(req), /verified staff/);
      await assert.rejects(service.register(req), /verified staff/);
      if (!req.user || !mfa.isPrivileged(user))
        await assert.rejects(service.list(req), /Staff account/);
      Object.assign(user, saved);
      req.user = user;
    }
  });
  it('rejects a changed, missing or demoted account at confirmation', async function () {
    for (const stored of [
      null,
      { ...user, authVersion: 1 },
      { ...user, roles: ['user'] },
      { ...user, mfaEnabled: false },
    ]) {
      User.findById.resolves(stored);
      await assert.rejects(service.registrationOptions(req), /Sign in again/);
    }
  });
  it('requires current credentials, a valid unused factor, and a bounded label', async function () {
    for (const password of [null, '', 'x'.repeat(1025)]) {
      req.body.currentPassword = password;
      await assert.rejects(
        service.registrationOptions(req),
        /Password confirmation/,
      );
    }
    req.body.currentPassword = 'fictional-password';
    user.authenticate.resolves(false);
    await assert.rejects(
      service.registrationOptions(req),
      /Password confirmation/,
    );
    user.authenticate.resolves(true);
    mfa.verifyAndConsume.resolves(null);
    await assert.rejects(service.registrationOptions(req), /code is invalid/);
    mfa.verifyAndConsume.resolves({ user });
    for (const label of [null, '', 'x'.repeat(65)]) {
      req.body.label = label;
      await assert.rejects(service.registrationOptions(req), /passkey name/);
    }
    keys.push(...Array(10).fill(key));
    await assert.rejects(service.registrationOptions(req), /Remove a passkey/);
  });
  it('rejects stale registration state and failed attestation', async function () {
    for (const stored of [null, { ...user, roles: ['user'] }]) {
      User.findOne.resolves(stored);
      await assert.rejects(service.register(req), /Sign in again/);
    }
    User.findOne.resolves(user);
    webauthn.verifyRegistrationResponse.resolves({ verified: false });
    await assert.rejects(service.register(req), /not accepted/);
    req.body.ceremonyId = {};
    await assert.rejects(service.register(req), /not accepted/);
    assert.equal(Ceremony.findOneAndDelete.lastCall.args[0]._id, '');
  });
  it('rejects expired password challenges and missing or demoted users', async function () {
    req.session = undefined;
    await assert.rejects(service.authenticationOptions(req), /Sign in again/);
    req.session = { mfaChallenge: mfa.createChallenge(user) };
    for (const stored of [null, { ...user, roles: ['user'] }]) {
      User.findOne.resolves(stored);
      await assert.rejects(service.authenticationOptions(req), /Sign in again/);
    }
    User.findOne.resolves(user);
    await assert.rejects(service.authenticationOptions(req), /No passkey/);
  });
  it('rejects missing keys, failed assertions, concurrent removal and changed account state', async function () {
    Key.findOne.returns({ select: async () => null });
    req.body.response = {};
    await assert.rejects(service.authenticate(req), /not accepted/);
    assert.equal(Key.findOne.firstCall.args[0]._id, '');
    req.body.response = undefined;
    await assert.rejects(service.authenticate(req), /not accepted/);
    Key.findOne.returns({ select: async () => key });
    webauthn.verifyAuthenticationResponse.resolves({ verified: false });
    await assert.rejects(service.authenticate(req), /not accepted/);
    webauthn.verifyAuthenticationResponse.resolves({
      verified: true,
      authenticationInfo: { newCounter: 2, credentialBackedUp: false },
    });
    Key.findOneAndUpdate.resolves(null);
    await assert.rejects(service.authenticate(req), /Passkey changed/);
    Key.findOneAndUpdate.resolves(key);
    for (const stored of [null, { ...user, roles: ['user'] }]) {
      User.findOne.resetBehavior();
      User.findOne.onFirstCall().resolves(user);
      User.findOne.onSecondCall().resolves(stored);
      User.findOne.resetHistory();
      await assert.rejects(service.authenticate(req), /Sign in again/);
    }
  });
});

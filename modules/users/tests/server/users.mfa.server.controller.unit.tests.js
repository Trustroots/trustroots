const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const sinon = require('sinon');
require('../../server/models/user.server.model.mjs');
const User = mongoose.model('User');

let controller;
let mfaService;
let profileHandler;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      return this;
    },
  };
}

function query(result) {
  return { exec: sinon.stub().resolves(result) };
}

function member(overrides = {}) {
  const user = {
    _id: 'fictional-user-id',
    username: 'fictional-member',
    mfaEnabled: false,
    authenticate: sinon.stub().resolves(true),
    $locals: {},
    ...overrides,
  };
  return { _id: user._id, user };
}

function request(user = member().user) {
  return {
    user,
    body: { currentPassword: 'CorrectPassword123!', code: '123456' },
    login: (authenticatedUser, callback) => callback(null),
    logout: callback => callback(null),
  };
}

describe('Authenticator MFA controller', () => {
  before(async () => {
    controller = (
      await import('../../server/controllers/users.mfa.server.controller.mjs')
    ).default;
    mfaService = (await import('../../server/services/mfa.server.service.mjs'))
      .default;
    profileHandler = (
      await import(
        '../../server/controllers/users.profile.server.controller.mjs'
      )
    ).default;
  });

  afterEach(() => sinon.restore());

  describe('beginEnrollment', () => {
    it('requires a signed-in member', async () => {
      const res = response();
      await controller.beginEnrollment(request(null), res);
      assert.equal(res.statusCode, 403);
    });

    it('requires a matching current password', async () => {
      const { user } = member();
      user.authenticate.resolves(false);
      sinon.stub(User, 'findById').returns(query(user));
      const res = response();
      await controller.beginEnrollment(request(user), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.message, 'Password confirmation failed.');
    });

    it('rejects a missing stored account', async () => {
      sinon.stub(User, 'findById').returns(query(null));
      const res = response();
      await controller.beginEnrollment(request(), res);
      assert.equal(res.statusCode, 400);
    });

    it('rejects an MFA account already enrolled', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      const res = response();
      await controller.beginEnrollment(request(user), res);
      assert.equal(res.statusCode, 409);
    });

    it('returns the staged authenticator setup', async () => {
      const { user } = member();
      sinon.stub(User, 'findById').returns(query(user));
      sinon.stub(mfaService, 'stageEnrollment').resolves({ secret: 'staged' });
      const res = response();
      await controller.beginEnrollment(request(user), res);
      assert.deepEqual(res.body, { secret: 'staged' });
    });

    it('returns unavailable when setup fails', async () => {
      const { user } = member();
      sinon.stub(User, 'findById').returns(query(user));
      sinon.stub(mfaService, 'stageEnrollment').rejects(new Error('failed'));
      const res = response();
      await controller.beginEnrollment(request(user), res);
      assert.equal(res.statusCode, 503);
    });
  });

  describe('verifyEnrollment', () => {
    it('requires a signed-in member', async () => {
      const res = response();
      await controller.verifyEnrollment(request(null), res);
      assert.equal(res.statusCode, 403);
    });

    it('rejects an expired or invalid enrolment code', async () => {
      const { user } = member();
      sinon.stub(mfaService, 'activateEnrollment').resolves(null);
      const res = response();
      await controller.verifyEnrollment(request(user), res);
      assert.equal(res.statusCode, 400);
    });

    it('activates MFA and refreshes the verified session', async () => {
      const { user } = member();
      const activatedUser = { ...user, $locals: {} };
      sinon.stub(mfaService, 'activateEnrollment').resolves({
        user: activatedUser,
        codes: ['RECOVERYCODE1234'],
      });
      sinon.stub(profileHandler, 'sanitizeOwnProfile').returns({ id: 'safe' });
      let loggedIn;
      const req = request(user);
      req.login = (value, callback) => {
        loggedIn = value;
        callback(null);
      };
      const res = response();
      await controller.verifyEnrollment(req, res);
      assert.equal(loggedIn, activatedUser);
      assert.equal(activatedUser.$locals.mfaVerified, true);
      assert.deepEqual(res.body, {
        enabled: true,
        recoveryCodes: ['RECOVERYCODE1234'],
        user: { id: 'safe' },
      });
    });

    it('reports failure to update the authenticated session', async () => {
      const { user } = member();
      sinon.stub(mfaService, 'activateEnrollment').resolves({
        user: { ...user, $locals: {} },
        codes: [],
      });
      const req = request(user);
      req.login = (value, callback) => callback(new Error('session failed'));
      const res = response();
      await controller.verifyEnrollment(req, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.message, 'Could not update the sign-in session.');
    });

    it('returns unavailable when activation fails', async () => {
      const { user } = member();
      sinon.stub(mfaService, 'activateEnrollment').rejects(new Error('failed'));
      const res = response();
      await controller.verifyEnrollment(request(user), res);
      assert.equal(res.statusCode, 503);
    });
  });

  describe('settings', () => {
    it('requires a signed-in member', async () => {
      const res = response();
      await controller.settings(request(null), res);
      assert.equal(res.statusCode, 403);
    });

    it('returns enabled state and remaining recovery codes', async () => {
      const storedUser = {
        mfaEnabled: true,
        mfaRecoveryCodeHashes: ['a', 'b'],
      };
      const findQuery = {
        select: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(storedUser),
      };
      sinon.stub(User, 'findById').returns(findQuery);
      const res = response();
      await controller.settings(request(), res);
      assert.equal(
        findQuery.select.firstCall.args[0],
        '+mfaRecoveryCodeHashes',
      );
      assert.deepEqual(res.body, { enabled: true, recoveryCodesRemaining: 2 });
    });

    it('returns disabled state when the account has been deleted or has no codes', async () => {
      sinon.stub(User, 'findById').returns({
        select: () => ({ exec: async () => ({ mfaEnabled: false }) }),
      });
      const res = response();
      await controller.settings(request(), res);
      assert.deepEqual(res.body, { enabled: false, recoveryCodesRemaining: 0 });
      User.findById.restore();
      sinon.stub(User, 'findById').returns({
        select: () => ({ exec: async () => null }),
      });
      await controller.settings(request(), res);
      assert.equal(res.statusCode, 404);
    });

    it('returns unavailable when settings cannot be loaded', async () => {
      sinon.stub(User, 'findById').throws(new Error('database failed'));
      const res = response();
      await controller.settings(request(), res);
      assert.equal(res.statusCode, 503);
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('requires a signed-in member and password confirmation', async () => {
      const res = response();
      await controller.regenerateRecoveryCodes(request(null), res);
      assert.equal(res.statusCode, 403);
    });

    it('requires MFA to be enabled', async () => {
      const { user } = member();
      sinon.stub(User, 'findById').returns(query(user));
      const res = response();
      await controller.regenerateRecoveryCodes(request(user), res);
      assert.equal(res.statusCode, 409);
    });

    it('rejects an invalid verification code', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon.stub(mfaService, 'verifyAndConsume').resolves(null);
      const res = response();
      await controller.regenerateRecoveryCodes(request(user), res);
      assert.equal(res.statusCode, 400);
    });

    it('stores hashed recovery codes and returns their one-time display', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon
        .stub(mfaService, 'verifyAndConsume')
        .resolves({ secret: 'ciphertext' });
      sinon
        .stub(mfaService, 'createRecoveryCodes')
        .returns(['ABCDEF0123456789']);
      sinon.stub(mfaService, 'hashRecoveryCode').returns('hashed-code');
      const updateQuery = {
        exec: sinon.stub().resolves({ ...user, $locals: {} }),
      };
      const update = sinon.stub(User, 'findOneAndUpdate').returns(updateQuery);
      const res = response();
      await controller.regenerateRecoveryCodes(request(user), res);
      assert.equal(update.firstCall.args[0].mfaSecretEncrypted, 'ciphertext');
      assert.deepEqual(update.firstCall.args[1].$set.mfaRecoveryCodeHashes, [
        'hashed-code',
      ]);
      assert.deepEqual(res.body, { recoveryCodes: ['ABCDEF0123456789'] });
    });

    it('rejects a stale recovery-code update', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon
        .stub(mfaService, 'verifyAndConsume')
        .resolves({ secret: 'ciphertext' });
      sinon.stub(mfaService, 'createRecoveryCodes').returns([]);
      sinon.stub(User, 'findOneAndUpdate').returns(query(null));
      const res = response();
      await controller.regenerateRecoveryCodes(request(user), res);
      assert.equal(res.statusCode, 409);
    });

    it('reports session refresh failures after recovery-code regeneration', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon
        .stub(mfaService, 'verifyAndConsume')
        .resolves({ secret: 'ciphertext' });
      sinon.stub(mfaService, 'createRecoveryCodes').returns([]);
      sinon
        .stub(User, 'findOneAndUpdate')
        .returns(query({ ...user, $locals: {} }));
      const req = request(user);
      req.login = (value, callback) => callback(new Error('session failed'));
      const res = response();
      await controller.regenerateRecoveryCodes(req, res);
      assert.equal(res.statusCode, 503);
    });

    it('returns unavailable when recovery-code regeneration fails', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').throws(new Error('database failed'));
      const res = response();
      await controller.regenerateRecoveryCodes(request(user), res);
      assert.equal(res.statusCode, 503);
    });
  });

  describe('disable', () => {
    it('requires a signed-in member and password confirmation', async () => {
      const res = response();
      await controller.disable(request(null), res);
      assert.equal(res.statusCode, 403);
    });

    it('requires MFA to be enabled', async () => {
      const { user } = member();
      sinon.stub(User, 'findById').returns(query(user));
      const res = response();
      await controller.disable(request(user), res);
      assert.equal(res.statusCode, 409);
    });

    it('rejects an invalid verification code', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon.stub(mfaService, 'verifyAndConsume').resolves(null);
      const res = response();
      await controller.disable(request(user), res);
      assert.equal(res.statusCode, 400);
    });

    it('rejects a stale removal', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon
        .stub(mfaService, 'verifyAndConsume')
        .resolves({ secret: 'ciphertext' });
      sinon.stub(mfaService, 'removeMfa').resolves(null);
      const res = response();
      await controller.disable(request(user), res);
      assert.equal(res.statusCode, 409);
    });

    it('logs the member out after removing MFA', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon
        .stub(mfaService, 'verifyAndConsume')
        .resolves({ secret: 'ciphertext' });
      sinon.stub(mfaService, 'removeMfa').resolves(user);
      let loggedOut = false;
      const req = request(user);
      req.logout = callback => {
        loggedOut = true;
        callback(null);
      };
      const res = response();
      await controller.disable(req, res);
      assert.equal(loggedOut, true);
      assert.deepEqual(res.body, { enabled: false });
    });

    it('reports logout errors and removal failures', async () => {
      const { user } = member({ mfaEnabled: true });
      sinon.stub(User, 'findById').returns(query(user));
      sinon
        .stub(mfaService, 'verifyAndConsume')
        .resolves({ secret: 'ciphertext' });
      sinon.stub(mfaService, 'removeMfa').resolves(user);
      const req = request(user);
      req.logout = callback => callback(new Error('logout failed'));
      const res = response();
      await controller.disable(req, res);
      assert.equal(res.statusCode, 503);

      sinon.restore();
      sinon.stub(User, 'findById').throws(new Error('database failed'));
      const failedRes = response();
      await controller.disable(request(user), failedRes);
      assert.equal(failedRes.statusCode, 503);
    });
  });
});

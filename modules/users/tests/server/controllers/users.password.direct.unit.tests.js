const sinon = require('sinon');
require('should');
const crypto = require('crypto');
const mongoose = require('mongoose');
const analyticsHandler = require('../../../../core/server/controllers/analytics.server.controller');
const emailService = require('../../../../core/server/services/email.server.service');
require('../../../server/models/user.server.model');
const User = mongoose.model('User');
const profileHandler = require('../../../server/controllers/users.profile.server.controller');
const statService = require('../../../../stats/server/services/stats.server.service');
const controller = require('../../../server/controllers/users.password.server.controller');

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

function loadController({
  user,
  confirmEmailError,
  findOneError,
  findOneAndUpdateError,
  findOneAndUpdateUser = user || null,
  validPassword = true,
  randomBytes,
  onStat = () => {},
} = {}) {
  sinon.restore();
  sinon.stub(User, 'isValidPassword').callsFake(() => validPassword);
  sinon.stub(User, 'hashPassword').callsFake(password => password);
  sinon
    .stub(User, 'findOne')
    .callsFake((query, projectionOrCallback, callback) => {
      const cb = callback || projectionOrCallback;
      cb(findOneError || null, user || null);
    });
  sinon.stub(User, 'findById').callsFake((id, cb) => cb(null, user || null));
  sinon
    .stub(User, 'findOneAndUpdate')
    .callsFake((query, update, options, cb) =>
      cb(findOneAndUpdateError || null, findOneAndUpdateUser),
    );
  sinon
    .stub(profileHandler, 'sanitizeOwnProfile')
    .callsFake(profile => profile);
  sinon.stub(analyticsHandler, 'appendUTMParams').callsFake(url => url);
  sinon
    .stub(emailService, 'sendResetPassword')
    .callsFake((profile, cb) => cb());
  sinon
    .stub(emailService, 'sendResetPasswordConfirm')
    .callsFake((profile, cb) => cb(confirmEmailError));
  sinon.stub(statService, 'stat').callsFake((payload, cb) => {
    onStat(payload);
    cb();
  });
  if (randomBytes) sinon.stub(crypto, 'randomBytes').callsFake(randomBytes);
  return controller;
}

function fakeUser(overrides = {}) {
  return {
    displayName: 'Direct User',
    email: 'direct@example.test',
    password: 'oldpassword1',
    salt: 'old-salt',
    _id: 'user-id',
    resetPasswordToken: 'reset-token',
    resetPasswordExpires: Date.now() + 3600000,
    save(cb) {
      cb();
    },
    authenticate(password) {
      return password === 'oldpassword1';
    },
    ...overrides,
  };
}

describe('Password controller direct unit tests', () => {
  describe('forgot', () => {
    it('acknowledges before token generation completes and logs token failures safely', async () => {
      let finishTokenGeneration;
      const controller = loadController({
        randomBytes: (length, cb) => {
          finishTokenGeneration = cb;
        },
      });
      const res = deferredResponse();

      controller.forgot({ body: { username: 'person@example.test' } }, res);
      (await res.waitForResponse()).statusCode.should.equal(200);
      await new Promise(resolve => setImmediate(resolve));
      finishTokenGeneration(new Error('private token error'));
    });

    it('handles account lookup and token persistence failures in the background', async () => {
      const completed = [];
      const lookupController = loadController({
        findOneError: new Error('lookup'),
        randomBytes: (length, cb) => cb(null, Buffer.from('token')),
        onStat: payload => completed.push(payload.tags.status),
      });
      const lookupResponse = deferredResponse();
      lookupController.forgot(
        { body: { username: 'person@example.test' } },
        lookupResponse,
      );
      (await lookupResponse.waitForResponse()).statusCode.should.equal(200);
      await new Promise(resolve => setImmediate(resolve));

      const saveFailure = fakeUser({ save: cb => cb(new Error('save')) });
      const saveController = loadController({
        user: saveFailure,
        randomBytes: (length, cb) => cb(null, Buffer.from('token')),
        onStat: payload => completed.push(payload.tags.status),
      });
      const saveResponse = deferredResponse();
      saveController.forgot(
        { body: { username: 'person@example.test' } },
        saveResponse,
      );
      (await saveResponse.waitForResponse()).statusCode.should.equal(200);
      await new Promise(resolve => setImmediate(resolve));
      completed.should.containEql('failed:lookup');
      completed.should.containEql('failed:tokenSave');
    });
  });
  afterEach(() => sinon.restore());

  describe('reset', () => {
    it('returns the reset failure response when login fails after save', async () => {
      const controller = loadController({ user: fakeUser() });
      const res = deferredResponse();

      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Password reset failed.');
    });

    it('returns a controlled failure when credential generation fails', async () => {
      const controller = loadController({
        randomBytes: () => {
          throw new Error('random source unavailable');
        },
      });
      const res = deferredResponse();

      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Password reset failed.');
    });

    it('uses a service unavailable response when password hashing is overloaded', async () => {
      const controller = loadController({
        findOneAndUpdateError: Object.assign(new Error('busy'), {
          status: 503,
        }),
      });
      const res = deferredResponse();

      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(503);
      res.body.message.should.equal('Password reset failed.');
    });
  });

  describe('changePassword', () => {
    it('rejects a password that fails validation', async () => {
      const controller = loadController({ validPassword: false });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Password should be more than 8 characters long.',
      );
    });

    it('reports a controlled error when credential generation fails', async () => {
      const controller = loadController({
        user: fakeUser(),
        randomBytes: () => {
          throw new Error('random source unavailable');
        },
      });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('random source unavailable');
    });

    it('rejects a stale password compare-and-set', async () => {
      const controller = loadController({
        user: fakeUser(),
        findOneAndUpdateUser: null,
      });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Current password is incorrect.');
    });

    it('reports a password update database error', async () => {
      const controller = loadController({
        user: fakeUser(),
        findOneAndUpdateError: new Error('database unavailable'),
      });
      const res = deferredResponse();
      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('database unavailable');
    });
    it('returns the login failure when reauthentication fails', async () => {
      const controller = loadController({ user: fakeUser() });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(new Error('login failed')),
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('login failed');
    });

    it('succeeds when the confirmation email fails after saving and logging in', async () => {
      const controller = loadController({
        user: fakeUser(),
        confirmEmailError: new Error('confirm email failed'),
      });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (user, cb) => cb(),
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Password changed successfully!');
    });
  });
});

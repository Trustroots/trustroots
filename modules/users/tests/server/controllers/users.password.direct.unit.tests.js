const sinon = require('sinon');
require('should');

const path = require('path');
const mongoose = require('mongoose');
const config = require('./../../../../../config/config.mjs');
config.files.server.models.forEach(modelPath =>
  require(path.resolve(modelPath)),
);
const analyticsHandler = require('./../../../../core/server/controllers/analytics.server.controller.mjs');
const emailService = require('./../../../../core/server/services/email.server.service.mjs');
require('./../../../server/models/user.server.model.mjs');
const User = mongoose.model('User');
const profileHandler = require('./../../../server/controllers/users.profile.server.controller.mjs');
const statService = require('./../../../../stats/server/services/stats.server.service.mjs');
const controller = require('./../../../server/controllers/users.password.server.controller.mjs');

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

function loadController({ user, confirmEmailError } = {}) {
  sinon.stub(User, 'findOne').callsFake((query, callback) => {
    callback(null, user || null);
  });
  sinon.stub(User, 'findById').callsFake((id, callback) => {
    callback(null, user || null);
  });
  sinon.stub(profileHandler, 'sanitizeProfile').callsFake(profile => profile);
  sinon.stub(analyticsHandler, 'appendUTMParams').callsFake(url => url);
  sinon
    .stub(emailService, 'sendResetPassword')
    .callsFake((profile, cb) => cb());
  sinon
    .stub(emailService, 'sendResetPasswordConfirm')
    .callsFake((profile, cb) => cb(confirmEmailError));
  sinon.stub(statService, 'stat').callsFake((payload, cb) => cb());
  return controller;
}

function fakeUser(overrides = {}) {
  return {
    displayName: 'Direct User',
    email: 'direct@example.test',
    password: 'oldpassword1',
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
  });

  describe('changePassword', () => {
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

    it('returns the confirmation email failure after saving and logging in', async () => {
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
      res.statusCode.should.equal(400);
      res.body.message.should.equal('confirm email failed');
    });
  });
});

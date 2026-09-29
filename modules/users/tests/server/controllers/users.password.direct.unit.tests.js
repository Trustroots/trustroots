const proxyquire = require('proxyquire').noCallThru();
require('should');

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

function loadController({ user, confirmEmailError, hashPassword } = {}) {
  const User = {
    hashPassword: hashPassword || (async password => `$scrypt$${password}`),
    isValidPassword: password =>
      typeof password === 'string' && password.length >= 8,
    findOne(query, cb) {
      cb(null, user || null);
    },
    findById(id, cb) {
      cb(null, user || null);
    },
    findOneAndUpdate(query, update, options, cb) {
      if (user) {
        user.lastPasswordUpdate = { query, update, options };
        Object.assign(user, update.$set || {});
        if (update.$unset && update.$unset.salt) delete user.salt;
        if (update.$inc && update.$inc.authVersion) {
          user.authVersion = (user.authVersion || 0) + update.$inc.authVersion;
        }
      }
      if (cb) {
        cb(null, user || null);
        return undefined;
      }
      return Promise.resolve(user || null);
    },
  };

  return proxyquire(
    '../../../server/controllers/users.password.server.controller',
    {
      mongoose: {
        model: () => User,
      },
      './users.profile.server.controller': {
        sanitizeProfile: profile => profile,
        sanitizeOwnProfile: profile => profile,
      },
      '../../../core/server/controllers/analytics.server.controller': {
        appendUTMParams: url => url,
      },
      '../../../core/server/services/email.server.service': {
        sendResetPassword: (profile, cb) => cb(),
        sendResetPasswordConfirm: (profile, cb) => cb(confirmEmailError),
      },
      '../../../stats/server/services/stats.server.service': {
        stat: (payload, cb) => cb(),
      },
      '../../../../config/lib/logger': () => {},
    },
  );
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
      return Promise.resolve(password === 'oldpassword1');
    },
    ...overrides,
  };
}

describe('Password controller direct unit tests', () => {
  describe('reset', () => {
    it('returns the reset failure response when login fails after the atomic update', async () => {
      const user = fakeUser();
      const controller = loadController({ user });
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
      user.lastPasswordUpdate.update.$set.password.should.match(/^\$scrypt\$/);
      user.lastPasswordUpdate.update.$unset.should.have.property('salt', 1);
      user.lastPasswordUpdate.update.$inc.authVersion.should.equal(1);
    });

    it('returns retryable service unavailable when hashing is overloaded', async () => {
      const error = new Error('busy');
      error.code = 'KDF_OVERLOADED';
      error.status = 503;
      const controller = loadController({
        user: fakeUser(),
        hashPassword: async () => {
          throw error;
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
          login: (authenticatedUser, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(503);
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
      const user = fakeUser();
      const controller = loadController({
        user,
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
      user.lastPasswordUpdate.update.$set.password.should.match(/^\$scrypt\$/);
      user.lastPasswordUpdate.update.$unset.should.have.property('salt', 1);
      user.lastPasswordUpdate.update.$inc.authVersion.should.equal(1);
    });

    it('returns retryable service unavailable when password hashing is overloaded', async () => {
      const error = new Error('busy');
      error.code = 'KDF_OVERLOADED';
      error.status = 503;
      const controller = loadController({
        user: fakeUser(),
        hashPassword: async () => {
          throw error;
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
          login: (user, cb) => cb(),
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(503);
    });
  });
});

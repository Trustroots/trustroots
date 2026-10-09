const mockModule = require('../../../../../testutils/server/mock-module');
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

function loadController({
  user,
  confirmEmailError,
  hashPassword,
  findOneError,
  findOneAndUpdateError,
  findOneAndUpdateUser = user || null,
  validPassword = true,
  randomBytes,
  onStat = () => {},
} = {}) {
  const User = {
    hashPassword: hashPassword || (async password => `$scrypt$${password}`),
    isValidPassword: password =>
      validPassword && typeof password === 'string' && password.length >= 8,
    findOne(query, projectionOrCallback, callback) {
      const cb = callback || projectionOrCallback;
      cb(findOneError || null, user || null);
    },
    findById(id, cb) {
      cb(null, user || null);
    },
    findOneAndUpdate(query, update, options, cb) {
      const error = findOneAndUpdateError || null;
      if (!error && user && findOneAndUpdateUser === user) {
        user.lastPasswordUpdate = { query, update, options };
        Object.assign(user, update.$set || {});
        if (update.$unset) {
          Object.keys(update.$unset).forEach(key => delete user[key]);
        }
        if (update.$inc && update.$inc.authVersion) {
          user.authVersion = (user.authVersion || 0) + update.$inc.authVersion;
        }
      }
      if (cb) {
        cb(error, findOneAndUpdateUser);
        return undefined;
      }
      return error
        ? Promise.reject(error)
        : Promise.resolve(findOneAndUpdateUser);
    },
  };

  return mockModule(
    require.resolve(
      '../../../server/controllers/users.password.server.controller.mjs',
    ),
    {
      mongoose: {
        model: () => User,
      },
      crypto: randomBytes ? { randomBytes } : require('crypto'),
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
        stat: (payload, cb) => {
          onStat(payload);
          cb();
        },
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
      let completeStats;
      const statsComplete = new Promise(resolve => {
        completeStats = resolve;
      });
      const makeController = options =>
        loadController({
          ...options,
          randomBytes: (length, cb) => cb(null, Buffer.from('token')),
          onStat: payload => {
            completed.push(payload.tags.status);
            if (completed.length === 2) completeStats();
          },
        });
      const lookupController = makeController({
        findOneError: new Error('lookup'),
      });
      const lookupResponse = deferredResponse();
      lookupController.forgot(
        { body: { username: 'person@example.test' } },
        lookupResponse,
      );
      (await lookupResponse.waitForResponse()).statusCode.should.equal(200);

      const saveFailure = fakeUser({ save: cb => cb(new Error('save')) });
      const saveController = makeController({ user: saveFailure });
      const saveResponse = deferredResponse();
      saveController.forgot(
        { body: { username: 'person@example.test' } },
        saveResponse,
      );
      (await saveResponse.waitForResponse()).statusCode.should.equal(200);

      await statsComplete;
      completed.should.containEql('failed:lookup');
      completed.should.containEql('failed:tokenSave');
    });
  });

  describe('reset', () => {
    it('does not log an MFA account in after password recovery', async () => {
      const user = fakeUser({ mfaEnabled: true });
      const controller = loadController({
        user,
        confirmEmailError: new Error('email temporarily unavailable'),
      });
      const res = deferredResponse();
      let loggedOut = false;
      const req = {
        params: { token: 'reset-token' },
        body: {
          newPassword: 'newpassword123',
          verifyPassword: 'newpassword123',
        },
        login: () => {
          throw new Error('MFA account must not be logged in');
        },
        logout: callback => {
          loggedOut = true;
          callback(null);
        },
      };

      controller.reset(req, res);

      await res.waitForResponse();
      loggedOut.should.be.true();
      res.body.should.deepEqual({ mfaRequired: true });
    });

    it('completes the MFA recovery response when confirmation email succeeds', async () => {
      const user = fakeUser({ mfaEnabled: true });
      const controller = loadController({ user });
      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          logout: callback => callback(null),
        },
        res,
      );

      await res.waitForResponse();
      res.body.should.deepEqual({ mfaRequired: true });
    });

    it('returns a controlled error when logout fails for an MFA recovery', async () => {
      const user = fakeUser({ mfaEnabled: true });
      const controller = loadController({ user });
      const res = deferredResponse();
      controller.reset(
        {
          params: { token: 'reset-token' },
          body: {
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          logout: callback => callback(new Error('logout failed')),
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Password reset failed.');
    });

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

    it('returns a controlled failure when the hash provider fails', async () => {
      const controller = loadController({
        hashPassword: async () => {
          throw new Error('hash provider unavailable');
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
    it('preserves an MFA-verified session when changing an MFA account password', async () => {
      const user = fakeUser({ mfaEnabled: true });
      const controller = loadController({ user });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id', $locals: { mfaVerified: true } },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (authenticatedUser, callback) => {
            authenticatedUser.$locals.mfaVerified.should.be.true();
            callback();
          },
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(200);
    });

    it('does not grant MFA verification when the current session lacks it', async () => {
      const user = fakeUser({
        mfaEnabled: true,
        $locals: { mfaVerified: true },
      });
      const controller = loadController({ user });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (authenticatedUser, callback) => {
            authenticatedUser.$locals.mfaVerified.should.be.false();
            callback();
          },
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(200);
    });

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
          login: (authenticatedUser, callback) => callback(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Password should be more than 8 characters long.',
      );
    });

    it('reports a controlled error when the hash provider fails', async () => {
      const controller = loadController({
        user: fakeUser(),
        hashPassword: async () => {
          throw new Error('hash provider unavailable');
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
      res.body.message.should.equal('hash provider unavailable');
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

    it('includes a legacy salt and non-zero auth version in its compare-and-set', async () => {
      const user = fakeUser({ salt: 'legacy-salt', authVersion: 3 });
      const controller = loadController({ user });
      const res = deferredResponse();

      controller.changePassword(
        {
          user: { id: 'user-id' },
          body: {
            currentPassword: 'oldpassword1',
            newPassword: 'newpassword123',
            verifyPassword: 'newpassword123',
          },
          login: (authenticatedUser, callback) => callback(),
        },
        res,
      );

      await res.waitForResponse();
      res.statusCode.should.equal(200);
      user.lastPasswordUpdate.query.salt.should.equal('legacy-salt');
      user.lastPasswordUpdate.query.authVersion.should.equal(3);
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

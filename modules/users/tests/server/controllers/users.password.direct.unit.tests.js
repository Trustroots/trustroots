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
  const User = {
    isValidPassword() {
      return validPassword;
    },
    hashPassword(password) {
      return password;
    },
    findOne(query, projectionOrCallback, callback) {
      const cb = callback || projectionOrCallback;
      cb(findOneError || null, user || null);
    },
    findById(id, cb) {
      cb(null, user || null);
    },
    findOneAndUpdate(query, update, options, cb) {
      cb(findOneAndUpdateError || null, findOneAndUpdateUser);
    },
  };

  return proxyquire(
    '../../../server/controllers/users.password.server.controller',
    {
      mongoose: {
        model: () => User,
      },
      crypto: randomBytes ? { randomBytes } : require('crypto'),
      './users.profile.server.controller': {
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

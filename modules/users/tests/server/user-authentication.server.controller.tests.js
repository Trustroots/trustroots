/** Unit tests for the OAuth helpers of the authentication controller. */
const proxyquire = require('proxyquire').noCallThru();
const crypto = require('crypto');
const mongoose = require('mongoose');
const sinon = require('sinon');
const should = require('should');

const testutils = require('../../../../testutils/server/server.testutil');
const authController = require('../../server/controllers/users.authentication.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');

const controllerPath =
  '../../server/controllers/users.authentication.server.controller';
/**
 * Express-like response mock that resolves a promise as soon as the controller
 * sends a response, so callback-based controllers can be awaited.
 */
function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });

  const res = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
  };

  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.redirect = function (url) {
    res.redirectUrl = url;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;

  return res;
}

describe('Authentication controller OAuth unit tests', () => {
  const jobs = testutils.catchJobs();

  afterEach(async () => {
    sinon.restore();
    jobs.length = 0;
    await utils.clearDatabase();
  });

  describe('removeOAuthProvider', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      authController.removeOAuthProvider({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an unknown provider', async () => {
      const res = deferredResponse();
      authController.removeOAuthProvider(
        { user: {}, params: { provider: 'myspace' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('No provider defined.');
    });

    it('returns 400 when saving after removing a provider fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.additionalProvidersData = { github: { id: 'gh-1' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();
      sinon.stub(userDoc, 'save').callsFake(cb => cb(new Error('save failed')));

      const req = {
        user: userDoc,
        params: { provider: 'github' },
        login: (user, cb) => cb(),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when login fails after removing a provider', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.additionalProvidersData = { github: { id: 'gh-1' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const req = {
        user: userDoc,
        params: { provider: 'github' },
        login: (user, cb) => cb(new Error('login failed')),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('removes the provider data and returns the sanitized user', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.additionalProvidersData = { github: { id: 'gh-1' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const req = {
        user: userDoc,
        params: { provider: 'github' },
        login: (user, cb) => cb(),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      (res.body.password === undefined).should.be.true();

      const reloaded = await User.findById(saved._id);
      Boolean(
        reloaded.additionalProvidersData &&
          reloaded.additionalProvidersData.github,
      ).should.be.false();
    });

    it('allows removing a provider that is not connected', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.additionalProvidersData = {};
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const req = {
        user: userDoc,
        params: { provider: 'github' },
        login: (user, cb) => cb(),
      };
      const res = deferredResponse();

      authController.removeOAuthProvider(req, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body._id.toString().should.equal(userDoc._id.toString());
    });
  });

  describe('signout', () => {
    it('redirects after Passport logs the user out', async () => {
      const res = deferredResponse();

      authController.signout({ logout: callback => callback() }, res, () => {});
      await res.waitForResponse();

      res.redirectUrl.should.equal('/');
    });

    it('forwards Passport logout errors', () => {
      const error = new Error('logout failed');
      const next = sinon.spy();

      authController.signout({ logout: callback => callback(error) }, {}, next);

      next.calledOnceWithExactly(error).should.be.true();
    });
  });

  describe('resendConfirmation', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      authController.resendConfirmation({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 when the user is already confirmed', async () => {
      const res = deferredResponse();
      authController.resendConfirmation({ user: { email: 'a@b.com' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Already confirmed.');
    });

    it('resends the email-change confirmation email', async () => {
      const [saved] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const userDoc = await User.findById(saved._id);
      userDoc.emailTemporary = 'new-email@example.com';
      userDoc.emailToken = 'token';
      await userDoc.save();

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
    });

    it('returns 400 when resending the confirmation email fails', async () => {
      const controller = proxyquire(controllerPath, {
        '../../../core/server/services/email.server.service': {
          sendSignupEmailConfirmation: (user, cb) => cb(new Error('smtp down')),
          sendEmailConfirmation: (user, cb) => cb(new Error('smtp down')),
        },
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'token';
      await userDoc.save();

      const res = deferredResponse();
      controller.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when generating a new confirmation token fails', async () => {
      sinon.stub(crypto, 'randomBytes').callsFake((size, cb) => {
        if (typeof cb === 'function') {
          cb(new Error('entropy unavailable'));
          return;
        }

        return Buffer.alloc(size);
      });
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      await userDoc.save();
      crypto.randomBytes.restore();
      sinon.stub(crypto, 'randomBytes').callsFake((size, cb) => {
        cb(new Error('entropy unavailable'));
      });

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when saving the new confirmation token fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      await userDoc.save();
      sinon.stub(userDoc, 'save').callsFake(cb => cb(new Error('save failed')));

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('resends the signup confirmation email', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'token';
      await userDoc.save();

      const res = deferredResponse();
      authController.resendConfirmation({ user: userDoc }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Sent confirmation email.');
    });
  });

  describe('signup', () => {
    function loadSignupController() {
      return proxyquire(controllerPath, {
        '../../../core/server/services/email.server.service': {
          sendSignupEmailConfirmation: (user, cb) => cb(),
        },
      });
    }

    it('rejects missing required fields', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      controller.signup({ body: { firstName: 'Ada' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects usernames with invalid characters', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      controller.signup(
        {
          body: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            username: 'has space',
            password: 'password123',
            email: 'ada@example.com',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects spammy signup attempts', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      controller.signup(
        {
          body: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            username: 'has_underscore',
            password: 'password123',
            email: 'ada@example.com',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('creates a user and logs them in', async () => {
      const controller = loadSignupController();
      const res = deferredResponse();
      const req = {
        body: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          username: 'adalovelace',
          password: 'password123',
          email: 'ada-signup@example.com',
        },
        login: (user, cb) => cb(),
      };
      controller.signup(req, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.username.should.equal('adalovelace');
    });

    it('returns an empty object when signup completes without a user', async () => {
      const controller = proxyquire(controllerPath, {
        async: {
          waterfall(steps, done) {
            done(null);
          },
        },
        '../../../stats/server/services/stats.server.service': {
          stat: (statsObject, callback) => callback(),
        },
      });
      const res = deferredResponse();

      controller.signup({ body: {}, login: (user, cb) => cb() }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.should.deepEqual({});
    });
  });

  describe('signupValidation', () => {
    it('rejects a missing username', async () => {
      const res = deferredResponse();
      authController.signupValidation({ body: {} }, res);
      await res.waitForResponse();
      res.body.valid.should.be.false();
      res.body.error.should.equal('username-missing');
    });

    it('rejects a reserved username', async () => {
      const res = deferredResponse();
      authController.signupValidation(
        { body: { username: 'trustroots' } },
        res,
      );
      await res.waitForResponse();
      res.body.valid.should.be.false();
      res.body.error.should.equal('username-not-available-reserved');
    });

    it('uses generic error metadata when validation fails without an error code', async () => {
      let stats;
      const controller = proxyquire(controllerPath, {
        async: {
          waterfall(steps, done) {
            done({ errors: {} });
          },
        },
        '../../../stats/server/services/stats.server.service': {
          stat: (statsObject, callback) => {
            stats = statsObject;
            callback();
          },
        },
      });
      const res = deferredResponse();

      controller.signupValidation({ body: { username: 'anything' } }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.valid.should.be.false();
      res.body.error.should.equal('other');
      stats.tags.reason.should.equal('other');
    });

    it('accepts an available username', async () => {
      const res = deferredResponse();
      authController.signupValidation(
        { body: { username: 'brandnewusername' } },
        res,
      );
      await res.waitForResponse();
      res.body.valid.should.be.true();
    });
  });

  describe('signin', () => {
    function loadSigninController(callback) {
      return proxyquire(controllerPath, {
        passport: {
          authenticate: (strategy, authCallback) => () =>
            authCallback.apply(null, callback()),
        },
      });
    }

    it('rejects wrong credentials', async () => {
      const controller = loadSigninController(() => [
        null,
        null,
        { message: 'Invalid credentials' },
      ]);
      const res = deferredResponse();
      controller.signin({}, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects suspended users', async () => {
      const controller = loadSigninController(() => [
        null,
        { roles: ['user', 'suspended'] },
        null,
      ]);
      const res = deferredResponse();
      controller.signin({}, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('logs in a valid user', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      const controller = loadSigninController(() => [null, userDoc, null]);
      const res = deferredResponse();
      const req = { login: (user, cb) => cb() };
      controller.signin(req, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body._id.toString().should.equal(userDoc._id.toString());
    });

    it('returns 400 when login fails after authentication', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      const controller = loadSigninController(() => [null, userDoc, null]);
      const res = deferredResponse();
      const req = { login: (user, cb) => cb(new Error('login failed')) };
      controller.signin(req, res, () => {});
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });

  describe('confirmEmail', () => {
    it('redirects invalid email tokens to the invalid confirmation page', async () => {
      const res = deferredResponse();
      authController.validateEmailToken({ params: { token: 'missing' } }, res);
      await res.waitForResponse();

      res.redirectUrl.should.equal('/confirm-email-invalid');
    });

    it('redirects valid email tokens to the confirmation page', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.emailToken = 'valid-token';
      await userDoc.save();

      const res = deferredResponse();
      authController.validateEmailToken(
        { params: { token: 'valid-token' } },
        res,
      );
      await res.waitForResponse();

      res.redirectUrl.should.equal('/confirm-email/valid-token');
    });

    it('confirms a signup email token', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'confirm-token';
      await userDoc.save();

      const res = deferredResponse();
      authController.confirmEmail(
        {
          params: { token: 'confirm-token' },
          login: (user, cb) => cb(),
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.profileMadePublic.should.be.true();

      const reloaded = await User.findById(saved._id);
      reloaded.public.should.be.true();
      should.not.exist(reloaded.emailToken);
    });

    it('returns 400 when the token is invalid', async () => {
      const res = deferredResponse();
      authController.confirmEmail({ params: { token: 'missing' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when updating the confirmed user fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = false;
      userDoc.emailTemporary = userDoc.email;
      userDoc.emailToken = 'confirm-token';
      await userDoc.save();

      sinon.stub(User, 'findOneAndUpdate').yields(new Error('update failed'));

      const res = deferredResponse();
      authController.confirmEmail(
        { params: { token: 'confirm-token' }, login: (user, cb) => cb() },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });
});

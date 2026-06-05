/**
 * Unit tests for the OAuth / Facebook helpers of the authentication
 * controller.
 *
 * These functions are not reached by the HTTP route tests, so they are called
 * directly here. The Facebook graph client is stubbed via proxyquire so the
 * token-extension logic can be exercised without touching the network.
 */
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const should = require('should');

const config = require('../../../../config/config');
const testutils = require('../../../../testutils/server/server.testutil');
const authController = require('../../server/controllers/users.authentication.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');

const controllerPath =
  '../../server/controllers/users.authentication.server.controller';
const facebookApiPath = '../../../../config/lib/facebook-api.js';

/**
 * Load the controller with the Facebook graph client stubbed.
 *
 * @param {Function} extendAccessToken - stub for `facebook.extendAccessToken`
 */
function loadControllerWithFacebook(extendAccessToken) {
  return proxyquire(controllerPath, {
    [facebookApiPath]: { extendAccessToken },
  });
}

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
  res.waitForResponse = () => promise;

  return res;
}

describe('Authentication controller OAuth/Facebook unit tests', () => {
  const jobs = testutils.catchJobs();

  afterEach(async () => {
    jobs.length = 0;
    await utils.clearDatabase();
  });

  describe('saveOAuthUserProfile', () => {
    it('errors when the user is not logged in', done => {
      authController.saveOAuthUserProfile(
        {},
        { provider: 'github', providerData: {} },
        (err, user) => {
          err.should.be.an.Error();
          err.message.should.match(/logged in/);
          (user === null).should.be.true();
          done();
        },
      );
    });

    it('attaches the provider data to the logged in user', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);

      const providerUserProfile = {
        provider: 'github',
        providerData: { id: 'gh-1', accessToken: 'token' },
      };

      const result = await new Promise((resolve, reject) => {
        authController.saveOAuthUserProfile(
          { user: userDoc },
          providerUserProfile,
          (err, user, redirectURL) => {
            if (err) return reject(err);
            resolve({ user, redirectURL });
          },
        );
      });

      result.redirectURL.should.equal('/profile/edit/networks');
      result.user.additionalProvidersData.github.id.should.equal('gh-1');
    });

    it('errors when the provider is already connected', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.additionalProvidersData = { github: { id: 'gh-1' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      await new Promise((resolve, reject) => {
        authController.saveOAuthUserProfile(
          { user: userDoc },
          { provider: 'github', providerData: { id: 'gh-2' } },
          err => {
            try {
              err.should.be.an.Error();
              err.message.should.match(/already connected/);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
        );
      });
    });
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
  });

  describe('updateFacebookOAuthToken', () => {
    it('responds with 400 when accessToken or userID is missing', async () => {
      const res = deferredResponse();
      authController.updateFacebookOAuthToken({ body: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('responds with 403 when there is no authenticated user', async () => {
      const res = deferredResponse();
      authController.updateFacebookOAuthToken(
        { body: { accessToken: 'a', userID: '1' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 403 when the user is not connected to Facebook', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);

      const res = deferredResponse();
      authController.updateFacebookOAuthToken(
        { body: { accessToken: 'a', userID: '1' }, user: userDoc },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 403 when the Facebook ids do not match', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.additionalProvidersData = { facebook: { id: 'real-fb-id' } };
      userDoc.markModified('additionalProvidersData');
      await userDoc.save();

      const res = deferredResponse();
      authController.updateFacebookOAuthToken(
        { body: { accessToken: 'a', userID: 'different-id' }, user: userDoc },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('stores a token without an expiry date', async () => {
      const originalClientID = config.facebook.clientID;
      const originalClientSecret = config.facebook.clientSecret;
      config.facebook.clientID = 'fb-client-id';
      config.facebook.clientSecret = 'fb-client-secret';

      try {
        const controller = loadControllerWithFacebook((options, cb) =>
          cb(null, { access_token: 'long-lived-token' }),
        );

        const [saved] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(saved._id);
        userDoc.additionalProvidersData = {
          facebook: {
            id: 'fb-id',
            accessTokenExpires: new Date(),
          },
        };
        userDoc.markModified('additionalProvidersData');
        await userDoc.save();

        const res = deferredResponse();
        controller.updateFacebookOAuthToken(
          {
            body: { accessToken: 'short-token', userID: 'fb-id' },
            user: userDoc,
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(200);

        const reloaded = await User.findById(saved._id);
        reloaded.additionalProvidersData.facebook.accessToken.should.equal(
          'long-lived-token',
        );
        should.not.exist(
          reloaded.additionalProvidersData.facebook.accessTokenExpires,
        );
      } finally {
        config.facebook.clientID = originalClientID;
        config.facebook.clientSecret = originalClientSecret;
      }
    });

    it('stores the extended token for a matching Facebook user', async () => {
      const originalClientID = config.facebook.clientID;
      const originalClientSecret = config.facebook.clientSecret;
      config.facebook.clientID = 'fb-client-id';
      config.facebook.clientSecret = 'fb-client-secret';

      try {
        const controller = loadControllerWithFacebook((options, cb) =>
          cb(null, { access_token: 'long-lived-token', expires_in: 3600 }),
        );

        const [saved] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(saved._id);
        userDoc.additionalProvidersData = { facebook: { id: 'fb-id' } };
        userDoc.markModified('additionalProvidersData');
        await userDoc.save();

        const res = deferredResponse();
        controller.updateFacebookOAuthToken(
          {
            body: { accessToken: 'short-token', userID: 'fb-id' },
            user: userDoc,
          },
          res,
        );
        await res.waitForResponse();

        res.statusCode.should.equal(200);
        res.body.message.should.equal('Token updated.');

        const reloaded = await User.findById(saved._id);
        reloaded.additionalProvidersData.facebook.accessToken.should.equal(
          'long-lived-token',
        );
      } finally {
        config.facebook.clientID = originalClientID;
        config.facebook.clientSecret = originalClientSecret;
      }
    });
  });

  describe('extendFBAccessToken', () => {
    const originalClientID = config.facebook.clientID;
    const originalClientSecret = config.facebook.clientSecret;

    afterEach(() => {
      config.facebook.clientID = originalClientID;
      config.facebook.clientSecret = originalClientSecret;
    });

    it('errors when no access token is given', done => {
      authController.extendFBAccessToken(undefined, (err, result) => {
        err.should.be.an.Error();
        err.message.should.equal('Missing access token.');
        result.should.deepEqual({});
        done();
      });
    });

    it('errors when Facebook is not configured', done => {
      config.facebook.clientID = false;
      config.facebook.clientSecret = false;
      authController.extendFBAccessToken('short-token', (err, result) => {
        err.should.be.an.Error();
        result.should.deepEqual({});
        done();
      });
    });

    it('passes through errors from the Facebook client', done => {
      config.facebook.clientID = 'id';
      config.facebook.clientSecret = 'secret';
      const controller = loadControllerWithFacebook((options, cb) =>
        cb(new Error('FB down')),
      );
      controller.extendFBAccessToken('short-token', err => {
        err.should.be.an.Error();
        err.message.should.equal('FB down');
        done();
      });
    });

    it('errors when the response has no access token', done => {
      config.facebook.clientID = 'id';
      config.facebook.clientSecret = 'secret';
      const controller = loadControllerWithFacebook((options, cb) =>
        cb(null, {}),
      );
      controller.extendFBAccessToken('short-token', (err, result) => {
        err.should.be.an.Error();
        result.should.deepEqual({});
        done();
      });
    });

    it('returns the token and an expiry date when expires_in is present', done => {
      config.facebook.clientID = 'id';
      config.facebook.clientSecret = 'secret';
      const controller = loadControllerWithFacebook((options, cb) =>
        cb(null, { access_token: 'long-token', expires_in: 5184000 }),
      );
      controller.extendFBAccessToken('short-token', (err, result) => {
        if (err) return done(err);
        result.token.should.equal('long-token');
        result.expires.should.be.a.Date();
        done();
      });
    });

    it('returns just the token when no expiry is present', done => {
      config.facebook.clientID = 'id';
      config.facebook.clientSecret = 'secret';
      const controller = loadControllerWithFacebook((options, cb) =>
        cb(null, { access_token: 'long-token' }),
      );
      controller.extendFBAccessToken('short-token', (err, result) => {
        if (err) return done(err);
        result.token.should.equal('long-token');
        (result.expires === undefined).should.be.true();
        done();
      });
    });
  });

  describe('oauthCallback', () => {
    function loadControllerWithPassport(handler) {
      return proxyquire(controllerPath, {
        passport: {
          authenticate: (strategy, callback) => (req, res, next) =>
            handler(strategy, callback, req, res, next),
        },
      });
    }

    it('redirects to the networks page on strategy error', async () => {
      const controller = loadControllerWithPassport((strategy, callback) => {
        callback(new Error('oauth failed'), null, null);
      });
      let resolveResponse;
      const promise = new Promise(resolve => {
        resolveResponse = resolve;
      });
      const res = deferredResponse();
      res.waitForResponse = () => promise;
      res.redirect = url => {
        res.redirectUrl = url;
        resolveResponse(res);
        return res;
      };

      controller.oauthCallback('github')({}, res, () => {});
      await res.waitForResponse();
      res.redirectUrl.should.equal('/profile/edit/networks');
    });

    it('redirects to signin when no user is returned', async () => {
      const controller = loadControllerWithPassport((strategy, callback) => {
        callback(null, null, null);
      });
      const res = deferredResponse();
      let resolveResponse;
      const promise = new Promise(resolve => {
        resolveResponse = resolve;
      });
      res.redirect = url => {
        res.redirectUrl = url;
        resolveResponse(res);
        return res;
      };
      res.waitForResponse = () => promise;

      controller.oauthCallback('github')({}, res, () => {});
      await res.waitForResponse();
      res.redirectUrl.should.equal('/signin');
    });

    it('redirects to signin when login fails', async () => {
      const controller = loadControllerWithPassport((strategy, callback) => {
        callback(null, { _id: 'user' }, '/custom-redirect');
      });
      const res = deferredResponse();
      let resolveResponse;
      const promise = new Promise(resolve => {
        resolveResponse = resolve;
      });
      res.redirect = url => {
        res.redirectUrl = url;
        resolveResponse(res);
        return res;
      };
      res.waitForResponse = () => promise;

      const req = { login: (user, cb) => cb(new Error('login failed')) };
      controller.oauthCallback('github')(req, res, () => {});
      await res.waitForResponse();
      res.redirectUrl.should.equal('/signin');
    });

    it('redirects to the provided URL after login', async () => {
      const controller = loadControllerWithPassport((strategy, callback) => {
        callback(null, { _id: 'user' }, '/custom-redirect');
      });
      const res = deferredResponse();
      let resolveResponse;
      const promise = new Promise(resolve => {
        resolveResponse = resolve;
      });
      res.redirect = url => {
        res.redirectUrl = url;
        resolveResponse(res);
        return res;
      };
      res.waitForResponse = () => promise;

      const req = { login: (user, cb) => cb() };
      controller.oauthCallback('github')(req, res, () => {});
      await res.waitForResponse();
      res.redirectUrl.should.equal('/custom-redirect');
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
  });
});

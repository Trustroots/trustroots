/**
 * Unit tests for the OAuth passport strategy configuration modules.
 *
 * These configure passport strategies and map third party profiles onto the
 * Trustroots user profile shape. The strategy classes and passport itself are
 * stubbed so nothing touches the network, which lets us exercise both the
 * "missing configuration" guard and the verify callback mapping directly.
 */
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

require('should');

/**
 * Load a strategy module with its passport strategy class, passport, and the
 * authentication controller stubbed out.
 *
 * @param {string} strategyPath - require path of the strategy module
 * @param {string} packageName - npm package the strategy class comes from
 * @returns {object} helpers to drive and inspect the loaded strategy
 */
function loadStrategy(strategyPath, packageName, stubOverrides = {}) {
  let capturedOptions;
  let capturedVerify;

  function FakeStrategy(options, verify) {
    capturedOptions = options;
    capturedVerify = verify;
    this.name = 'fake';
  }

  const passportUse = sinon.spy();
  const saveOAuthUserProfile = sinon.spy();

  const strategy = proxyquire(strategyPath, {
    [packageName]: { Strategy: FakeStrategy },
    passport: { use: passportUse },
    '../../controllers/users.authentication.server.controller': {
      saveOAuthUserProfile,
    },
    ...stubOverrides,
  });

  return {
    strategy,
    passportUse,
    saveOAuthUserProfile,
    getOptions: () => capturedOptions,
    getVerify: () => capturedVerify,
  };
}

describe('OAuth strategy configuration unit tests', () => {
  const fullConfig = providerKey => ({
    [providerKey]: {
      clientID: 'id',
      clientSecret: 'secret',
      callbackURL: 'https://example.com/callback',
    },
  });

  describe('GitHub strategy', () => {
    const strategyPath = '../../server/config/strategies/github';

    it('does not register the strategy when configuration is missing', () => {
      const { strategy, passportUse } = loadStrategy(
        strategyPath,
        'passport-github',
      );
      strategy({});
      passportUse.called.should.be.false();
    });

    it('registers the strategy and maps the profile', () => {
      const harness = loadStrategy(strategyPath, 'passport-github');
      harness.strategy(fullConfig('github'));
      harness.passportUse.calledOnce.should.be.true();

      const req = {};
      const done = () => {};
      const profile = {
        _json: { login: 'octocat' },
        displayName: 'The Octocat',
        username: 'octocat',
        emails: [{ value: 'octo@example.com' }],
      };

      harness.getVerify()(req, 'access-token', 'refresh-token', profile, done);

      harness.saveOAuthUserProfile.calledOnce.should.be.true();
      const [passedReq, providerUserProfile, passedDone] =
        harness.saveOAuthUserProfile.firstCall.args;
      passedReq.should.equal(req);
      passedDone.should.equal(done);
      providerUserProfile.provider.should.equal('github');
      providerUserProfile.providerIdentifierField.should.equal('id');
      providerUserProfile.displayName.should.equal('The Octocat');
      providerUserProfile.username.should.equal('octocat');
      providerUserProfile.email.should.equal('octo@example.com');
      providerUserProfile.providerData.accessToken.should.equal('access-token');
      providerUserProfile.providerData.refreshToken.should.equal(
        'refresh-token',
      );
      providerUserProfile.providerData.login.should.equal('octocat');
    });

    it('falls back to username for the display name and tolerates a missing _json', () => {
      const harness = loadStrategy(strategyPath, 'passport-github');
      harness.strategy(fullConfig('github'));

      const profile = { username: 'octocat' };
      harness.getVerify()({}, 'token', 'refresh', profile, () => {});

      const providerUserProfile =
        harness.saveOAuthUserProfile.firstCall.args[1];
      providerUserProfile.displayName.should.equal('octocat');
      (providerUserProfile.email === undefined).should.be.true();
      providerUserProfile.providerData.accessToken.should.equal('token');
    });
  });

  describe('Twitter strategy', () => {
    const strategyPath = '../../server/config/strategies/twitter';

    it('does not register the strategy when configuration is missing', () => {
      const { strategy, passportUse } = loadStrategy(
        strategyPath,
        'passport-twitter',
      );
      strategy({});
      passportUse.called.should.be.false();
    });

    it('registers the strategy and maps the profile', () => {
      const harness = loadStrategy(strategyPath, 'passport-twitter');
      harness.strategy(fullConfig('twitter'));
      harness.passportUse.calledOnce.should.be.true();

      const profile = {
        _json: { id_str: '123' },
        displayName: 'Jack',
        username: 'jack',
      };

      harness.getVerify()({}, 'token', 'token-secret', profile, () => {});

      const providerUserProfile =
        harness.saveOAuthUserProfile.firstCall.args[1];
      providerUserProfile.provider.should.equal('twitter');
      providerUserProfile.providerIdentifierField.should.equal('id_str');
      providerUserProfile.displayName.should.equal('Jack');
      providerUserProfile.username.should.equal('jack');
      providerUserProfile.providerData.token.should.equal('token');
      providerUserProfile.providerData.tokenSecret.should.equal('token-secret');
    });
  });

  describe('Facebook strategy', () => {
    const strategyPath = '../../server/config/strategies/facebook';
    const loggerPath = '../../../../../config/lib/logger';

    it('does not register or log when configuration is missing in test env', () => {
      const log = sinon.spy();
      const { strategy, passportUse } = loadStrategy(
        strategyPath,
        'passport-facebook',
        { [loggerPath]: log },
      );
      strategy({});
      passportUse.called.should.be.false();
      log.called.should.be.false();
    });

    it('logs an error when configuration is missing outside test env', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const log = sinon.spy();
        const { strategy, passportUse } = loadStrategy(
          strategyPath,
          'passport-facebook',
          { [loggerPath]: log },
        );
        strategy({});
        passportUse.called.should.be.false();
        log.calledOnce.should.be.true();
        log.firstCall.args[0].should.equal('error');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('registers the strategy and maps the profile', () => {
      const log = sinon.spy();
      const harness = loadStrategy(strategyPath, 'passport-facebook', {
        [loggerPath]: log,
      });
      harness.strategy(fullConfig('facebook'));
      harness.passportUse.calledOnce.should.be.true();

      const profile = {
        _json: { id: '42' },
        name: { first_name: 'Mark', last_name: 'Z' },
        email: 'mark@example.com',
      };

      harness.getVerify()(
        {},
        'access-token',
        'refresh-token',
        profile,
        () => {},
      );

      const providerUserProfile =
        harness.saveOAuthUserProfile.firstCall.args[1];
      providerUserProfile.provider.should.equal('facebook');
      providerUserProfile.providerIdentifierField.should.equal('id');
      providerUserProfile.firstName.should.equal('Mark');
      providerUserProfile.lastName.should.equal('Z');
      providerUserProfile.email.should.equal('mark@example.com');
      providerUserProfile.providerData.accessToken.should.equal('access-token');
      providerUserProfile.providerData.refreshToken.should.equal(
        'refresh-token',
      );
    });
  });
});

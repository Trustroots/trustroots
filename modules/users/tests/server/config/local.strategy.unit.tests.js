/**
 * Unit tests for uncovered local passport strategy branches.
 */
const mockModule = require('../../../../../testutils/server/mock-module');
const sinon = require('sinon');

const should = require('should');

describe('Local passport strategy unit tests', () => {
  let User;
  let verify;
  let strategyOptions;
  let passwordHashing;

  beforeEach(() => {
    User = {
      findOne: sinon.stub(),
    };
    passwordHashing = {
      verifyPassword: sinon.stub().resolves({
        valid: false,
        needsRehash: false,
      }),
    };

    function FakeLocalStrategy(options, strategyVerify) {
      strategyOptions = options;
      verify = strategyVerify;
    }

    const passportUse = sinon.spy();
    const configureStrategy = mockModule(
      require.resolve('../../../server/config/strategies/local.mjs'),
      {
        mongoose: {
          model: () => User,
        },
        passport: {
          use: passportUse,
        },
        'passport-local': {
          Strategy: FakeLocalStrategy,
        },
        '../../services/password-hashing.server.service': passwordHashing,
      },
    );

    configureStrategy();

    passportUse.calledOnce.should.be.true();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('rejects structured credentials before looking up an account', () => {
    for (const [username, password] of [
      [{ $ne: null }, 'example-password'],
      [['sample-member'], 'example-password'],
      [null, 'example-password'],
      ['sample-member', { $ne: null }],
      ['sample-member', ['example-password']],
      ['a'.repeat(321), 'example-password'],
    ]) {
      const done = sinon.spy();
      verify(username, password, done);
      done
        .calledOnceWithExactly(null, false, {
          message: 'Unknown user or invalid password',
        })
        .should.be.true();
    }
    User.findOne.called.should.be.false();
    passwordHashing.verifyPassword.called.should.be.false();
  });

  it('configures username and password fields', () => {
    strategyOptions.usernameField.should.equal('username');
    strategyOptions.passwordField.should.equal('password');
  });

  it('returns an error when the database lookup fails', done => {
    User.findOne.callsFake((query, cb) => {
      cb(new Error('db down'));
    });

    verify('testuser', 'password', (err, user, info) => {
      err.message.should.equal('db down');
      should(user).be.undefined();
      should(info).be.undefined();
      done();
    });
  });

  it('returns false when the user does not exist', done => {
    User.findOne.callsFake((query, cb) => {
      cb(null, null);
    });

    verify('missinguser', 'password', (err, user, info) => {
      should(err).be.null();
      user.should.equal(false);
      info.message.should.equal('Unknown user or invalid password');
      done();
    });
  });

  it('returns false when the password is invalid', done => {
    const user = {
      authenticate: sinon.stub().resolves(false),
    };

    User.findOne.callsFake((query, cb) => {
      cb(null, user);
    });

    verify('localstrategy', 'wrong-password', (err, foundUser, info) => {
      should(err).be.null();
      foundUser.should.equal(false);
      info.message.should.equal('Unknown user or invalid password');
      done();
    });
  });

  it('finds users by lowercase username or email and returns the user on valid password', done => {
    const user = {
      authenticate: sinon.stub().withArgs('right-password').resolves(true),
    };

    User.findOne.callsFake((query, cb) => {
      query.should.deepEqual({
        $or: [
          { username: 'mixedcase@example.com' },
          { email: 'mixedcase@example.com' },
        ],
      });
      cb(null, user);
    });

    verify(
      'MixedCase@Example.com',
      'right-password',
      (err, foundUser, info) => {
        should(err).be.null();
        foundUser.should.equal(user);
        should(info).be.undefined();
        user.authenticate
          .calledOnceWithExactly('right-password')
          .should.be.true();
        done();
      },
    );
  });

  it('does current-cost dummy verification when the user does not exist', done => {
    User.findOne.callsFake((query, cb) => cb(null, null));

    verify('missinguser', 'candidate-password', (err, user, info) => {
      should(err).be.null();
      user.should.equal(false);
      info.message.should.equal('Unknown user or invalid password');
      passwordHashing.verifyPassword
        .calledOnceWithExactly('candidate-password', null, null)
        .should.be.true();
      done();
    });
  });

  it('passes KDF errors to Passport for retryable handling', done => {
    const error = new Error('capacity full');
    error.code = 'KDF_OVERLOADED';
    const user = { authenticate: sinon.stub().rejects(error) };
    User.findOne.callsFake((query, cb) => cb(null, user));

    verify('localstrategy', 'candidate-password', (err, foundUser) => {
      err.should.equal(error);
      should(foundUser).be.undefined();
      done();
    });
  });
});

/**
 * Unit tests for uncovered local passport strategy branches.
 */
import type { SinonStub } from 'sinon';

const mockModule: typeof import('../../../../../testutils/server/mock-module.mts').default = require('../../../../../testutils/server/mock-module');
const sinon: typeof import('sinon') = require('sinon');

const should = require('should');

describe('Local passport strategy unit tests', () => {
  interface AuthenticatedUser {
    authenticate(password: string): Promise<boolean>;
  }
  type VerifyCallback = (
    error: Error | null,
    user?: AuthenticatedUser | false | null,
    info?: { message: string },
  ) => void;
  type Verify = (
    username: unknown,
    password: unknown,
    callback: VerifyCallback,
  ) => void;
  type FindOneCallback = (
    error: Error | null,
    user?: AuthenticatedUser | null,
  ) => void;
  type UserQuery = {
    $or: Array<{ username?: string; email?: string }>;
  };
  type UserDouble = {
    findOne: SinonStub<[query: UserQuery, callback: FindOneCallback], void>;
  };
  type PasswordHashingDouble = {
    verifyPassword: SinonStub<
      [password: string, storedHash: null, legacySalt: null],
      Promise<{ valid: boolean; needsRehash: boolean }>
    >;
  };
  let User: UserDouble;
  let verify: Verify;
  let strategyOptions: { usernameField: string; passwordField: string };
  let passwordHashing: PasswordHashingDouble;

  beforeEach(() => {
    User = {
      findOne: sinon.stub<[UserQuery, FindOneCallback], void>(),
    };
    passwordHashing = {
      verifyPassword: sinon
        .stub<
          [password: string, storedHash: null, legacySalt: null],
          Promise<{ valid: boolean; needsRehash: boolean }>
        >()
        .resolves({
          valid: false,
          needsRehash: false,
        }),
    };

    function FakeLocalStrategy(
      options: { usernameField: string; passwordField: string },
      strategyVerify: Verify,
    ) {
      strategyOptions = options;
      verify = strategyVerify;
    }

    const passportUse = sinon.spy();
    const configureStrategy = mockModule<() => void>(
      require.resolve('../../../server/config/strategies/local.mts'),
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

  it('rejects structured credentials before looking up an account', async () => {
    const invalidCredentials: Array<[unknown, unknown, string]> = [
      [{ $ne: null }, 'example-password', 'example-password'],
      [['sample-member'], 'example-password', 'example-password'],
      [null, 'example-password', 'example-password'],
      ['sample-member', { $ne: null }, ''],
      ['sample-member', ['example-password'], ''],
      ['a'.repeat(321), 'example-password', 'example-password'],
    ];
    for (const [
      username,
      password,
      expectedDummyPassword,
    ] of invalidCredentials) {
      passwordHashing.verifyPassword.resetHistory();
      const done = sinon.spy();
      verify(username, password, done);
      await new Promise(resolve => setImmediate(resolve));
      done
        .calledOnceWithExactly(null, false, {
          message: 'Unknown user or invalid password',
        })
        .should.be.true();
      passwordHashing.verifyPassword
        .calledOnceWithExactly(expectedDummyPassword, null, null)
        .should.be.true();
    }
    User.findOne.called.should.be.false();
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
      if (!err) return done(new Error('expected database error'));
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
      if (user !== false)
        return done(new Error('expected authentication failure'));
      user.should.equal(false);
      if (!info) return done(new Error('expected unknown-user message'));
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
      if (foundUser !== false)
        return done(new Error('expected authentication failure'));
      foundUser.should.equal(false);
      if (!info) return done(new Error('expected unknown-user message'));
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
        if (!foundUser || typeof foundUser === 'boolean') {
          return done(new Error('expected authenticated user'));
        }
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
      if (user !== false)
        return done(new Error('expected authentication failure'));
      user.should.equal(false);
      if (!info) return done(new Error('expected unknown-user message'));
      info.message.should.equal('Unknown user or invalid password');
      passwordHashing.verifyPassword
        .calledOnceWithExactly('candidate-password', null, null)
        .should.be.true();
      done();
    });
  });

  it('passes KDF errors to Passport for retryable handling', done => {
    const error = new Error('capacity full');
    Object.assign(error, { code: 'KDF_OVERLOADED' });
    const user = { authenticate: sinon.stub().rejects(error) };
    User.findOne.callsFake((query, cb) => cb(null, user));

    verify('localstrategy', 'candidate-password', (err, foundUser) => {
      if (!err) return done(new Error('expected KDF error'));
      err.should.equal(error);
      should(foundUser).be.undefined();
      done();
    });
  });
});

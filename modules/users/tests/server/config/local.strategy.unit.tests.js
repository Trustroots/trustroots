/**
 * Unit tests for uncovered local passport strategy branches.
 */
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const should = require('should');

describe('Local passport strategy unit tests', () => {
  let User;
  let verify;
  let strategyOptions;

  beforeEach(() => {
    User = {
      findOne: sinon.stub(),
    };

    function FakeLocalStrategy(options, strategyVerify) {
      strategyOptions = options;
      verify = strategyVerify;
    }

    const passportUse = sinon.spy();
    const configureStrategy = proxyquire(
      '../../../server/config/strategies/local',
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
      },
    );

    configureStrategy();

    passportUse.calledOnce.should.be.true();
  });

  afterEach(() => {
    sinon.restore();
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
      authenticate: sinon.stub().returns(false),
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
      authenticate: sinon.stub().withArgs('right-password').returns(true),
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
});

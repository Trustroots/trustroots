/**
 * Unit tests for uncovered local passport strategy branches.
 */
const passport = require('passport');
const mongoose = require('mongoose');
const sinon = require('sinon');

require('should');

const User = mongoose.model('User');

describe('Local passport strategy unit tests', () => {
  let verify;

  before(() => {
    require('../../../server/config/strategies/local')();
    const strategy = passport._strategy('local');
    verify = strategy._verify;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns an error when the database lookup fails', done => {
    sinon.stub(User, 'findOne').callsFake((query, cb) => {
      cb(new Error('db down'));
    });

    verify('testuser', 'password', (err, user, info) => {
      err.message.should.equal('db down');
      user.should.be.undefined();
      info.should.be.undefined();
      done();
    });
  });

  it('returns false when the user does not exist', done => {
    sinon.stub(User, 'findOne').callsFake((query, cb) => {
      cb(null, null);
    });

    verify('missinguser', 'password', (err, user, info) => {
      err.should.be.undefined();
      user.should.equal(false);
      info.message.should.equal('Unknown user or invalid password');
      done();
    });
  });

  it('returns false when the password is invalid', done => {
    const user = new User({
      public: true,
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      email: 'local-strategy@example.com',
      username: 'localstrategy',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
    });

    sinon.stub(User, 'findOne').callsFake((query, cb) => {
      cb(null, user);
    });

    verify('localstrategy', 'wrong-password', (err, foundUser, info) => {
      err.should.be.undefined();
      foundUser.should.equal(false);
      info.message.should.equal('Unknown user or invalid password');
      done();
    });
  });
});

/**
 * Module dependencies.
 */
const should = require('should');
const mongoose = require('mongoose');
const path = require('path');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const SupportRequest = mongoose.model('SupportRequest');

/**
 * Globals
 */
let user;
let _support;
let support;

/**
 * Unit tests
 */
describe('Support request Model Unit Tests:', function () {
  beforeEach(function (done) {
    user = new User({
      firstName: 'Joe',
      lastName: 'Doe',
      displayName: 'Joe Doe',
      email: 'test@test.com',
      username: 'joedoe',
      password: 'password123',
      provider: 'local',
    });

    _support = {
      email: 'joedoe@test.com',
      username: 'joedoe',
      message: 'Testing.',
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0',
      reportMember: 'baduser',
    };

    support = new SupportRequest(_support);

    // Create user
    user.save(function (err, userRes) {
      support.user = userRes._id;
      return done();
    });
  });

  after(utils.clearDatabase);

  describe('Method Save', function () {
    it('should be able to save without problems', function (done) {
      support.save(function (err, supportRes) {
        should.not.exist(err);
        supportRes.email.should.equal(_support.email);
        supportRes.username.should.equal(_support.username);
        supportRes.message.should.equal(_support.message);
        supportRes.userAgent.should.equal(_support.userAgent);
        supportRes.reportMember.should.equal(_support.reportMember);
        should.exist(supportRes.sent);
        return done();
      });
    });

    it('should be able to save without problems without user id', function (done) {
      const supportWithoutUser = new SupportRequest(_support);

      supportWithoutUser.save(function (err, supportRes) {
        should.not.exist(err);
        should.not.exist(supportRes.user);
        return done();
      });
    });

    it('should not be able to save without message', function (done) {
      delete _support.message;
      const supportWithoutMessage = new SupportRequest(_support);

      supportWithoutMessage.save(function (err) {
        should.exist(err);
        return done();
      });
    });

    it('should be able to save without problems without any other fields than message', function (done) {
      const supportOnlyMessage = new SupportRequest({
        message: _support.message,
      });

      supportOnlyMessage.save(function (err, supportRes) {
        should.not.exist(err);
        should.exist(supportRes.sent);
        supportRes.message.should.equal(_support.message);
        should.not.exist(supportRes.user);
        should.not.exist(supportRes.username);
        should.not.exist(supportRes.email);
        should.not.exist(supportRes.reportUser);
        should.not.exist(supportRes.userAgent);
        return done();
      });
    });
  });
});

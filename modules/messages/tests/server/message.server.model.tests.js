/**
 * Module dependencies.
 */
var should = require('should'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message');

/**
 * Globals
 */
var userTo,
    userFrom,
    message;

/**
 * Unit tests
 */
describe('Message Model Unit Tests:', function () {

  beforeEach(function (done) {

    userFrom = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local'
    });
    userTo = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local'
    });

    // Create users
    userFrom.save(function () {
      userTo.save(function () {
        // Check id for userTo
        User.findOne({ 'username': userTo.username }, function (err, userTo) {
          // Create message & continue
          message = new Message({
            content: 'Message content',
            userTo: userTo._id,
            read: false
          });
          return done();
        });
      });

    });
  });

  describe('Method Save', function () {
    it('should be able to save without problems', function (done) {
      message.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to send without content', function (done) {
      message.userTo = '';

      message.save(function (err) {
        should.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to send without receiver', function (done) {
      message.content = '';

      message.save(function (err) {
        should.exist(err);
        return done();
      });
    });

  });

  afterEach(function (done) {
    Message.deleteMany().exec(function () {
      User.deleteMany().exec(done);
    });
  });
});

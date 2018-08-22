'use strict';

var should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
var app,
    agent,
    credentials,
    user,
    supportMessage;

/**
 * Support routes tests
 */
describe('Support CRUD tests', function () {

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'loremipsum',
      password: 'Password123!'
    };

    // Create a new user
    user = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true
    });

    // Create new support message
    supportMessage = {
      username: user.username,
      email: user.email,
      message: 'Trustroots rocks!'
    };

    // Save user to the test db
    user.save(function (err) {
      should.not.exist(err);
      return done();
    });
  });

  it('should be able to send support message when not logged in', function (done) {
    agent.post('/api/support')
      .send(supportMessage)
      .expect(200)
      .end(function (supportSaveErr, supportSaveRes) {

        supportSaveRes.body.message.should.equal('Support request sent.');

        // Call the assertion callback
        return done(supportSaveErr);
      });
  });

  it('should be able to send support message wihout email and username', function (done) {
    agent.post('/api/support')
      .send({
        username: '',
        email: '',
        message: 'Trustroots is cool!'
      })
      .expect(200)
      .end(function (supportSaveErr, supportSaveRes) {

        supportSaveRes.body.message.should.equal('Support request sent.');

        // Call the assertion callback
        return done(supportSaveErr);
      });
  });

  it('should be able to send support message when logged in', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Send support message
        agent.post('/api/support')
          .send(supportMessage)
          .expect(200)
          .end(function (supportSaveErr, supportSaveRes) {

            supportSaveRes.body.message.should.equal('Support request sent.');

            // Call the assertion callback
            return done(supportSaveErr);
          });

      });
  });

  afterEach(function (done) {
    // Clean out
    User.remove().exec(done);
  });
});

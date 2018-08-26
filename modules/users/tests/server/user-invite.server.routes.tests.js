'use strict';

var request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    inviteCodeService = require(path.resolve('./modules/users/server/services/invite-codes.server.service')),
    express = require(path.resolve('./config/lib/express'));

require('should');

/**
 * Globals
 */
var app,
    agent,
    credentials,
    user,
    _user;

/**
 * User routes tests
 */
describe('User invites CRUD tests', function () {

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  // Create an user
  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'TR_username',
      password: 'TR-I$Aw3$0m4'
    };

    // Create a new user
    _user = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      username: credentials.username.toLowerCase(),
      displayUsername: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true
    };

    user = new User(_user);

    // Save a user to the test db
    user.save(done);
  });

  it('should be able to receive invite code when authenticated', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        agent.get('/api/users/invitecode')
          .expect(200)
          .end(function (userInviteCodeErr, userInviteCodeRes) {

            // Handle error
            if (userInviteCodeErr) {
              return done(userInviteCodeErr);
            }

            // Get code from the service
            var code = inviteCodeService.getCode();

            // Service code should match to the one received via route
            userInviteCodeRes.body.code.should.equal(code);

            return done();
          });
      });
  });

  it('should not able to receive invite code when not authenticated', function (done) {

    agent.get('/api/users/invitecode')
      .expect(403)
      .end(function (userInviteCodeErr, userInviteCodeRes) {

        // Handle error
        if (userInviteCodeErr) {
          return done(userInviteCodeErr);
        }

        userInviteCodeRes.body.message.should.equal('Forbidden.');

        return done();
      });
  });

  it('should be able to validate invite code when not authenticated', function (done) {

    var code = inviteCodeService.getCode();

    agent.post('/api/users/invitecode/' + code)
      .expect(200)
      .end(function (userInviteCodeErr, userInviteCodeRes) {

        // Handle error
        if (userInviteCodeErr) {
          return done(userInviteCodeErr);
        }

        userInviteCodeRes.body.valid.should.equal(true);

        return done();
      });
  });

  it('should be able to validate invite code in all caps', function (done) {

    var code = inviteCodeService.getCode();

    agent.post('/api/users/invitecode/' + code.toUpperCase())
      .expect(200)
      .end(function (userInviteCodeErr, userInviteCodeRes) {

        // Handle error
        if (userInviteCodeErr) {
          return done(userInviteCodeErr);
        }

        userInviteCodeRes.body.valid.should.equal(true);

        return done();
      });
  });

  it('should be able to return false for invalid code', function (done) {

    agent.post('/api/users/invitecode/INVALID')
      .expect(200)
      .end(function (userInviteCodeErr, userInviteCodeRes) {

        // Handle error
        if (userInviteCodeErr) {
          return done(userInviteCodeErr);
        }

        userInviteCodeRes.body.valid.should.equal(false);

        return done();
      });
  });

  it('should be able to validate invite code from predefined list', function (done) {

    var code = 'trustroots'; // Defined at `./configs/env/default.js`

    agent.post('/api/users/invitecode/' + code)
      .expect(200)
      .end(function (userInviteCodeErr, userInviteCodeRes) {

        // Handle error
        if (userInviteCodeErr) {
          return done(userInviteCodeErr);
        }

        userInviteCodeRes.body.valid.should.equal(true);

        return done();
      });
  });

  it('should be able to redirect to correct page using short invite URL', function (done) {

    agent.get('/c/CODE')
      .expect(301)
      .expect('Location', '/signup?code=CODE')
      .end(done);
  });

  afterEach(function (done) {
    User.remove().exec(done);
  });
});

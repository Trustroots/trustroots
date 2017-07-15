'use strict';

var request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    should = require('should'),
    sinon = require('sinon'),
    User = mongoose.model('User'),
    express = require(path.resolve('./config/lib/express'));

describe('Last seen', function () {
  /**
   * Globals
   */
  var app,
      agent,
      _confirmedUser,
      sandbox,
      confirmedUser;


  before(function (done) {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);

    done();
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.useFakeTimers(1500000000000, 'Date');
  });

  afterEach(function () {
    sandbox.restore();
  });

  // Create a confirmed user

  beforeEach(function (done) {

    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'confirmed-test@test.com',
      username: 'usertest',
      displayUsername: 'usertest',
      password: 'aPassWoRd_*....',
      provider: 'local'
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    confirmedUser.save(done);
  });

  afterEach(function (done) {
    User.remove().exec(done);
  });

  context('logged in', function () {
    // Sign in
    beforeEach(function (done) {
      var credentials = { username: _confirmedUser.username, password: _confirmedUser.password };

      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err) {
          if (err) return done(err);
          return done();
        });
    });

    // Sign out
    afterEach(function (done) {
      agent.get('/api/auth/signout')
        .expect(302)
        .end(function (err) {
          if (err) return done(err);
          return done();
        });
    });

    it('should update the last seen date of logged user when accessing api', function (done) {
      // Read statistics
      //
      // TODO decide which requests should update lastseen and which not
      sandbox.clock.tick(20);
      agent.get('/api/messages')
        .expect(200)
        .end(function(statsReadErr) {
          if (statsReadErr) return done(statsReadErr);

          // read user from database
          User.findOne({ username: _confirmedUser.username }, function (err, user) {
            try {
              should(user.seen).eql(new Date());
              return done();
            } catch (err) {
              return done(err);
            }
          });

        });
    });
  });

});

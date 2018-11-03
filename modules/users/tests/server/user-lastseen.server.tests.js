'use strict';

var request = require('supertest'),
    path = require('path'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    should = require('should'),
    sinon = require('sinon'),
    User = mongoose.model('User'),
    config = require(path.resolve('./config/config')),
    express = require(path.resolve('./config/lib/express'));

describe('User last seen CRUD tests', function () {
  /**
   * Globals
   */
  var app,
      agent,
      _confirmedUser,
      confirmedUser;


  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function () {
    sinon.useFakeTimers({ now: 1500000000000, toFake: ['Date'] });
  });

  afterEach(function () {
    sinon.restore();
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
      sinon.clock.tick(20);
      agent.get('/api/messages')
        .expect(200)
        .end(function (err) {
          if (err) return done(err);

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

    it('should update the last seen date only if a specific time passed since the last update', function (done) {
      // the user's username, shortcut
      var username = _confirmedUser.username;

      // how long should we wait between updates on minimum
      var minutesToUpdate = { minutes: 1 }; // 1 minute

      sinon.stub(config.limits, 'timeToUpdateLastSeenUser').value(minutesToUpdate);

      var timeToUpdate = moment.duration(minutesToUpdate).asMilliseconds();

      var originalTime = new Date();
      // update for the first time, OK
      agent.get('/api/messages')
        .expect(200)
        .end(function () {
          // read user from database
          User.findOne({ username: username }, function (err, user) {
            try {
              should(user.seen).eql(originalTime);

              // now wait almost for the time to update
              sinon.clock.tick(timeToUpdate - 1);
              agent.get('/api/messages')
                .expect(200)
                .end(function () {
                  // and the User.seen should not be updated (too early)
                  User.findOne({ username: username }, function (err, user) {
                    try {
                      should(user.seen).eql(originalTime);

                      // now wait for another 2 milliseconds
                      sinon.clock.tick(2);

                      agent.get('/api/messages')
                        .expect(200)
                        .end(function () {
                          // and the User.seen should be updated now
                          User.findOne({ username: username }, function (err, user) {
                            should(user.seen).eql(new Date());

                            return done();
                          });
                        });

                    } catch (err) {
                      return done(err);
                    }
                  });
                });
            } catch (err) {
              return done(err);
            }
          });

        });

    });
  });

});

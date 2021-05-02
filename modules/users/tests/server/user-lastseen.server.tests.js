const request = require('supertest');
const path = require('path');
const moment = require('moment');
const mongoose = require('mongoose');
const should = require('should');
const sinon = require('sinon');
const config = require(path.resolve('./config/config'));
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');

describe('User last seen CRUD tests', function () {
  /**
   * Globals
   */
  let app;
  let agent;
  let _confirmedUser;
  let confirmedUser;

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
      password: 'aPassWoRd_*....',
      provider: 'local',
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    confirmedUser.save(done);
  });

  afterEach(utils.clearDatabase);

  context('logged in', function () {
    // Sign in
    beforeEach(async () => {
      const credentials = {
        username: _confirmedUser.username,
        password: _confirmedUser.password,
      };
      await utils.signIn(credentials, agent);
    });

    // Sign out
    afterEach(async () => {
      await utils.signOut(agent);
    });

    afterEach(utils.clearDatabase);

    it('should update the last seen date of logged user when accessing api', function (done) {
      // Read statistics
      sinon.clock.tick(20);
      agent
        .get('/api/messages')
        .expect(200)
        .end(function (err) {
          if (err) return done(err);

          // read user from database
          User.findOne(
            { username: _confirmedUser.username },
            function (err, user) {
              try {
                should(user.seen).eql(new Date());
                return done();
              } catch (err) {
                return done(err);
              }
            },
          );
        });
    });

    it('should update the last seen date only if a specific time passed since the last update', function (done) {
      // the user's username, shortcut
      const username = _confirmedUser.username;

      // how long should we wait between updates on minimum
      const minutesToUpdate = { minutes: 1 }; // 1 minute

      sinon
        .stub(config.limits, 'timeToUpdateLastSeenUser')
        .value(minutesToUpdate);

      const timeToUpdate = moment.duration(minutesToUpdate).asMilliseconds();

      const originalTime = new Date();
      // update for the first time, OK
      agent
        .get('/api/messages')
        .expect(200)
        .end(function () {
          // read user from database
          User.findOne({ username }, function (err, user) {
            try {
              should(user.seen).eql(originalTime);

              // now wait almost for the time to update
              sinon.clock.tick(timeToUpdate - 1);
              agent
                .get('/api/messages')
                .expect(200)
                .end(function () {
                  // and the User.seen should not be updated (too early)
                  User.findOne({ username }, function (err, user) {
                    try {
                      should(user.seen).eql(originalTime);

                      // now wait for another 2 milliseconds
                      sinon.clock.tick(2);

                      agent
                        .get('/api/messages')
                        .expect(200)
                        .end(function () {
                          // and the User.seen should be updated now
                          User.findOne({ username }, function (err, user) {
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

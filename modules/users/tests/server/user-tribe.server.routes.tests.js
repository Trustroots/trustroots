const should = require('should');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Tribe = mongoose.model('Tribe');

/**
 * Globals
 */
let app;
let agent;
let credentials;
let user;
let _user;

/**
 * User routes tests
 */
describe('User tribe memberships CRUD tests', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'TR_username',
      password: 'TR-I$Aw3$0m4',
    };

    // Create a new user
    _user = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      emailToken: 'initial email token',
      username: credentials.username.toLowerCase(),
      password: credentials.password,
      provider: 'local',
    };

    user = new User(_user);

    // Save a user to the test db
    user.save(done);
  });

  afterEach(utils.clearDatabase);

  it('should be able to join a tribe', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Awesome Tribe',
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          agent
            .post('/api/users/memberships/' + tribe._id)
            .send()
            .expect(200)
            .end(function (userTribeErr, userTribeRes) {
              // Handle joining tag error
              if (userTribeErr) {
                return done(userTribeErr);
              }

              // Confirmation message
              userTribeRes.body.message.should.be.equal('Joined tribe.');

              // It should return correct tribe with new count
              userTribeRes.body.tribe._id.should.be.equal(tribe._id.toString());
              userTribeRes.body.tribe.count.should.be.equal(1);
              userTribeRes.body.tribe.label.should.be.equal('Awesome Tribe');
              userTribeRes.body.tribe.slug.should.be.equal('awesome-tribe');
              should.exist(userTribeRes.body.tribe.color);

              // It should return updated user
              userTribeRes.body.user.username.should.be.equal(
                credentials.username.toLowerCase(),
              );
              userTribeRes.body.user.memberIds[0].should.be.equal(
                tribe._id.toString(),
              );
              userTribeRes.body.user.member[0].tribe.should.be.equal(
                tribe._id.toString(),
              );
              should.exist(userTribeRes.body.user.member[0].since);

              return done();
            });
        });
      });
  });

  it('should be able to leave tribes', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Hitchhikers',
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          // Join tribe
          agent
            .post('/api/users/memberships/' + tribe._id)
            .send()
            .expect(200)
            .end(function (userTribeJoinErr, userTribeJoinRes) {
              // Handle joining tag error
              if (userTribeJoinErr) {
                return done(userTribeJoinErr);
              }

              // Count +1
              userTribeJoinRes.body.tribe.count.should.be.equal(1);

              // User is now member of tribe
              userTribeJoinRes.body.user.memberIds.length.should.be.equal(1);
              userTribeJoinRes.body.user.member.length.should.be.equal(1);

              // Leave tribe
              agent
                .delete('/api/users/memberships/' + tribe._id)
                .send()
                .expect(200)
                .end(function (userTagLeaveErr, userTagLeaveRes) {
                  // Handle leaving tag error
                  if (userTagLeaveErr) {
                    return done(userTagLeaveErr);
                  }

                  // Count -1
                  userTagLeaveRes.body.tribe.count.should.be.equal(0);

                  // No more tribes left on user's array
                  userTagLeaveRes.body.user.memberIds.length.should.be.equal(0);
                  userTagLeaveRes.body.user.member.length.should.be.equal(0);

                  return done();
                });
            });
        });
      });
  });

  it('should be able to show error if trying to join same tribe twice', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Russian literature students',
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          // Join tribe
          agent
            .post('/api/users/memberships/' + tribe._id)
            .send()
            .expect(200)
            .end(function (userTribeJoinErr, userTribeJoinRes) {
              // Handle joining tag error
              if (userTribeJoinErr) {
                return done(userTribeJoinErr);
              }

              // Count +1
              userTribeJoinRes.body.tribe.count.should.be.equal(1);

              // User is now member of tribe
              userTribeJoinRes.body.user.memberIds.length.should.be.equal(1);
              userTribeJoinRes.body.user.member.length.should.be.equal(1);

              // Join tribe again
              agent
                .post('/api/users/memberships/' + tribe._id)
                .send()
                .expect(409)
                .end(function (userTagJoin2Err, userTagJoin2Res) {
                  // Handle leaving tag error
                  if (userTagJoin2Err) {
                    return done(userTagJoin2Err);
                  }

                  userTagJoin2Res.body.message.should.be.equal(
                    'You are already a member of this tribe.',
                  );

                  return done();
                });
            });
        });
      });
  });

  it('should be able to show error if trying to leave tribe user is not member', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        const tribe = new Tribe({
          label: 'Japanese linguistics',
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          // Leave tribe
          agent
            .delete('/api/users/memberships/' + tribe._id)
            .send()
            .expect(409)
            .end(function (userTribeJoinErr, userTribeJoinRes) {
              // Handle joining tag error
              if (userTribeJoinErr) {
                return done(userTribeJoinErr);
              }

              userTribeJoinRes.body.message.should.be.equal(
                'You are not a member of this tribe.',
              );

              return done();
            });
        });
      });
  });

  it('should be able to show error if trying to join non-existing tribe', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Join tribe
        agent
          .post('/api/users/memberships/572a3d36f905fe5c53bf1d1f')
          .send()
          .expect(400)
          .end(function (userTribeJoinErr, userTribeJoinRes) {
            // Handle joining tag error
            if (userTribeJoinErr) {
              return done(userTribeJoinErr);
            }

            userTribeJoinRes.body.message.should.be.equal('Bad request.');

            return done();
          });
      });
  });

  it('should be able to show error if trying to join tribe with non standard ID', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Join tribe
        agent
          .post('/api/users/memberships/123456')
          .send()
          .expect(400)
          .end(function (userTribeJoinErr, userTribeJoinRes) {
            // Handle joining tag error
            if (userTribeJoinErr) {
              return done(userTribeJoinErr);
            }

            userTribeJoinRes.body.message.should.be.equal(
              'Cannot interpret id.',
            );

            return done();
          });
      });
  });
});

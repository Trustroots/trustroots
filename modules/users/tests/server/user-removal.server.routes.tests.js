const fs = require('fs');
const async = require('async');
const should = require('should');
const sinon = require('sinon');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const config = require(path.resolve('./config/config'));
const express = require(path.resolve('./config/lib/express'));
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const dataUtils = require(path.resolve(
  './testutils/server/data.server.testutil',
));

const User = mongoose.model('User');
const Contact = mongoose.model('Contact');
const Message = mongoose.model('Message');
const Offer = mongoose.model('Offer');
const Tribe = mongoose.model('Tribe');

/**
 * Globals
 */
let app;
let agent;
let credentialsA;
let credentialsB;
let userA;
let _userA;
let userB;
let _userB;

/**
 * User routes tests
 */
describe('User removal CRUD tests', function () {
  const jobs = testutils.catchJobs();

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  // initialize sinon
  beforeEach(function () {
    sinon.useFakeTimers({ now: 1500 * 1000 * 1000 * 1000, toFake: ['Date'] });
  });

  afterEach(function () {
    sinon.restore();
  });

  // Create an user A
  beforeEach(function (done) {
    // Create user credentials for user A
    credentialsA = {
      username: 'user_a',
      password: 'M3@n.jsI$Aw3$0m3',
    };

    // Create a new user A
    _userA = {
      public: true,
      firstName: 'Full',
      lastName: 'Name A',
      displayName: 'Full Name A',
      email: 'user_a@example.com',
      username: credentialsA.username.toLowerCase(),
      password: credentialsA.password,
      provider: 'local',
    };

    userA = new User(_userA);

    // Save a user to the test db
    userA.save(done);
  });

  // Create user B
  beforeEach(function (done) {
    // Create user credentials for user B
    credentialsB = {
      username: 'user_b',
      password: 'M3@n.jsI$Aw3$0m3',
    };

    // Create a new user B
    _userB = {
      public: true,
      firstName: 'Full',
      lastName: 'Name B',
      displayName: 'Full Name B',
      email: 'user_b@example.com',
      username: credentialsB.username.toLowerCase(),
      password: credentialsB.password,
      provider: 'local',
    };

    userB = new User(_userB);

    // Save a user to the test db
    userB.save(done);
  });

  afterEach(dataUtils.clearDatabase);

  it('should not be able to initiate removing profile when not logged in', function (done) {
    agent
      .del('/api/users')
      .expect(403)
      .end(function (deleteErr) {
        // Handle signup error
        if (deleteErr) {
          return done(deleteErr);
        }

        jobs.length.should.equal(0);

        // User should still exist
        User.findOne(
          { username: userA.username },
          function (findUsersErr, findUser) {
            if (findUsersErr) {
              return done(findUsersErr);
            }

            findUser.username.should.equal(userA.username);

            done();
          },
        );
      });
  });

  it('Signin in should not reveal profile removal tokens', function (done) {
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    userA.removeProfileExpires = new Date();

    userA.save(function (err) {
      should.not.exist(err);

      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr, signinRes) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          // Sensitive information should be not sent to the client
          should.not.exist(signinRes.body.removeProfileToken);
          should.not.exist(signinRes.body.removeProfileExpires);

          done();
        });
    });
  });

  it('should be able to initiate removing profile when signed in', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentialsA)
      .expect(200)
      .end(function (signinErr, signedInUser) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        agent
          .del('/api/users')
          .expect(200)
          .end(function (deleteErr, deleteRes) {
            // Handle signup error
            if (deleteErr) {
              return done(deleteErr);
            }

            deleteRes.body.message.should.equal(
              'We sent you an email with further instructions.',
            );

            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal(
              'Confirm removing your Trustroots profile',
            );
            jobs[0].data.to.address.should.equal(_userA.email);

            User.findById(
              signedInUser.body._id,
              function (findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                jobs[0].data.text.should.containEql(
                  '/remove/' + findUser.removeProfileToken,
                );

                should.exist(findUser.removeProfileExpires);
                should.exist(findUser.removeProfileToken);

                done();
              },
            );
          });
      });
  });

  it('should be able to initiate removing profile when already initiated once earlier', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentialsA)
      .expect(200)
      .end(function (signinErr, signedInUser) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        agent
          .del('/api/users')
          .expect(200)
          .end(function (deleteErr1, deleteRes1) {
            // Handle signup error
            if (deleteErr1) {
              return done(deleteErr1);
            }

            deleteRes1.body.message.should.equal(
              'We sent you an email with further instructions.',
            );

            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal(
              'Confirm removing your Trustroots profile',
            );
            jobs[0].data.to.address.should.equal(_userA.email);

            User.findById(
              signedInUser.body._id,
              function (findUsersErr1, findUser1) {
                if (findUsersErr1) {
                  return done(findUsersErr1);
                }

                jobs[0].data.text.should.containEql(
                  '/remove/' + findUser1.removeProfileToken,
                );

                should.exist(findUser1.removeProfileExpires);
                should.exist(findUser1.removeProfileToken);

                // Send another delete request
                // This should refresh token to new one so check everything again
                agent
                  .del('/api/users')
                  .expect(200)
                  .end(function (deleteErr2, deleteRes2) {
                    // Handle signup error
                    if (deleteErr2) {
                      return done(deleteErr2);
                    }

                    deleteRes2.body.message.should.equal(
                      'We sent you an email with further instructions.',
                    );

                    jobs.length.should.equal(2); // now two because earlier we sent already one
                    jobs[1].type.should.equal('send email');
                    jobs[1].data.subject.should.equal(
                      'Confirm removing your Trustroots profile',
                    );
                    jobs[1].data.to.address.should.equal(_userA.email);

                    User.findById(
                      signedInUser.body._id,
                      function (findUsersErr2, findUser2) {
                        if (findUsersErr2) {
                          return done(findUsersErr2);
                        }

                        jobs[1].data.text.should.containEql(
                          '/remove/' + findUser2.removeProfileToken,
                        );

                        should.exist(findUser2.removeProfileExpires);
                        should.exist(findUser2.removeProfileToken);

                        done();
                      },
                    );
                  });
              },
            );
          });
      });
  });

  it('should be able to confirm removing profile when signed in', function (done) {
    userA.removeProfileExpires = Date.now() + 24 * 3600000;
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    userA.save(function (err, savedUser) {
      should.not.exist(err);

      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .del('/api/users/remove/' + savedUser.removeProfileToken)
            .expect(200)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal(
                'Your profile has been removed.',
              );

              jobs.length.should.equal(1);
              jobs[0].type.should.equal('send email');
              jobs[0].data.subject.should.equal(
                'Your Trustroots profile has been removed',
              );
              jobs[0].data.to.address.should.equal(_userA.email);
              jobs[0].data.text.should.containEql(
                'Your Trustroots account has been removed.',
              );

              User.findById(savedUser._id, function (findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                should.not.exist(findUser);

                done();
              });
            });
        });
    });
  });

  it('should not able to initiate removing profile with role "shadowban"', function (done) {
    userA.roles = ['user', 'shadowban'];

    userA.save(function (err) {
      should.not.exist(err);

      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          agent
            .del('/api/users')
            .expect(403)
            .end(function (deleteErr, deleteRes) {
              should.not.exist(deleteErr);

              deleteRes.body.message.should.equal(
                'Oops! Something went wrong. Please get in touch with support at trustroots.org/support',
              );
              jobs.length.should.equal(0);

              done();
            });
        });
    });
  });

  it('should not be able to confirm removing profile when not signed in', function (done) {
    userA.removeProfileExpires = Date.now() + 24 * 3600000;
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    userA.save(function (err, savedUser) {
      should.not.exist(err);

      agent
        .del('/api/users/remove/' + savedUser.removeProfileToken)
        .expect(403)
        .end(function (deleteErr, deleteRes) {
          // Handle signup error
          if (deleteErr) {
            return done(deleteErr);
          }

          deleteRes.body.message.should.equal('Forbidden.');

          jobs.length.should.equal(0);

          // User should still exist
          User.findById(savedUser._id, function (findUsersErr, findUser) {
            if (findUsersErr) {
              return done(findUsersErr);
            }

            findUser.removeProfileToken.should.equal(userA.removeProfileToken);

            done();
          });
        });
    });
  });

  it('should not be able to confirm removing profile with wrong token', function (done) {
    userA.removeProfileExpires = Date.now() + 24 * 3600000;
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    userA.save(function (err, savedUser) {
      should.not.exist(err);

      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .del('/api/users/remove/wrongtoken')
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal(
                'Profile remove token is invalid or has expired.',
              );

              jobs.length.should.equal(0);

              // User should still exist
              User.findById(savedUser._id, function (findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                findUser.removeProfileToken.should.equal(
                  userA.removeProfileToken,
                );

                done();
              });
            });
        });
    });
  });

  it('should not be able to confirm removing profile with expired token', function (done) {
    userA.removeProfileExpires = Date.now() - 24 * 3600000; // 24h in the past
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    userA.save(function (err, savedUser) {
      should.not.exist(err);

      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .del('/api/users/remove/' + userA.removeProfileToken)
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal(
                'Profile remove token is invalid or has expired.',
              );

              jobs.length.should.equal(0);

              // User should still exist
              User.findById(savedUser._id, function (findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                findUser.removeProfileToken.should.equal(
                  userA.removeProfileToken,
                );

                done();
              });
            });
        });
    });
  });

  it('should not be able to confirm removing profile when signed in as wrong user', function (done) {
    userA.removeProfileExpires = Date.now() + 24 * 3600000;
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    userA.save(function (err, savedUser) {
      should.not.exist(err);

      agent
        .post('/api/auth/signin')
        .send(credentialsB) // User B signs in insetead of user A
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .del('/api/users/remove/' + userA.removeProfileToken)
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal(
                'Profile remove token is invalid or has expired.',
              );

              jobs.length.should.equal(0);

              // User should still exist
              User.findById(savedUser._id, function (findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                findUser.removeProfileToken.should.equal(
                  userA.removeProfileToken,
                );

                // Signed in user should still exist
                User.findOne(
                  { username: userB.username },
                  function (findUsersErr, findUser) {
                    if (findUsersErr) {
                      return done(findUsersErr);
                    }

                    findUser.username.should.equal(userB.username);
                    should.not.exist(userB.removeProfileExpires);
                    should.not.exist(userB.removeProfileToken);

                    done();
                  },
                );
              });
            });
        });
    });
  });

  context('logged in & valid token', function () {
    function sendDeleteRequest(cb) {
      agent
        .del('/api/users/remove/' + userA.removeProfileToken)
        .expect(200)
        .end(function (deleteErr) {
          cb(deleteErr);
        });
    }

    // sign in
    beforeEach(function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          return done(signinErr);
        });
    });

    // save removeToken for user a
    beforeEach(function (done) {
      userA.removeProfileExpires = Date.now() + 24 * 3600000;
      userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

      userA.save(done);
    });

    it('should remove profile images', function (done) {
      // Each user has their own folder for avatars
      const uploadDir =
        path.resolve(config.uploadDir) + '/' + userA._id + '/avatar'; // No trailing slash

      function checkAvatarExistence(shouldExist, cb) {
        const exists = fs.existsSync(uploadDir);

        try {
          should(exists).eql(shouldExist);
          cb();
        } catch (e) {
          cb(e);
        }
      }

      async.waterfall(
        [
          // Avatar should not exist yet
          checkAvatarExistence.bind(null, false),

          // Upload avatar image
          function (cb) {
            agent
              .post('/api/users-avatar')
              .attach('avatar', './modules/users/tests/server/img/avatar.png')
              .expect(200)
              .end(function (err) {
                cb(err);
              });
          },

          // Avatar should now exist
          checkAvatarExistence.bind(null, true),

          sendDeleteRequest,

          // Avatar should not exist anymore
          checkAvatarExistence.bind(null, false),
        ],
        done,
      );
    });

    it('should mark all messages to the removed user as notified and keep the ones from her untouched', function (done) {
      async.waterfall(
        [
          // create some unnotified messages between the users
          function (cb) {
            const messageAB = new Message({
              content: 'Message content',
              userFrom: userA._id,
              userTo: userB._id,
              read: false,
            });

            const messageBA = new Message({
              content: 'Message content',
              userFrom: userB._id,
              userTo: userA._id,
              read: false,
            });

            async.each(
              [messageAB, messageBA],
              function (msg, callback) {
                msg.save(callback);
              },
              cb,
            );
          },

          sendDeleteRequest,

          // check that the messages to the removed user are notificationCount: 2
          function (cb) {
            Message.findOne({ userTo: userA._id }, function (err, msg) {
              try {
                should(msg.notificationCount).eql(2);
                cb();
              } catch (e) {
                cb(e);
              }
            });
          },

          // check that the messages from the removed user are left unchanged
          function (cb) {
            Message.findOne({ userFrom: userA._id }, function (err, msg) {
              try {
                should(msg.notificationCount).eql(0);
                cb();
              } catch (e) {
                cb(e);
              }
            });
          },
        ],
        done,
      );
    });

    it('should subtract 1 from tribes.count for each tribe user is member of', function (done) {
      let tribeA;
      let tribeB;

      async.waterfall(
        [
          // Create some tribes
          function (cb) {
            tribeA = new Tribe({
              label: 'Tribe A',
              attribution: 'Photo credits',
              attribution_url: 'http://www.trustroots.org/team',
              image_UUID: '3c8bb9f1-e313-4baa-bf4c-1d8994fd6c6c',
              description: 'Lorem ipsum.',
              count: 5,
            });

            tribeB = new Tribe({
              label: 'Tribe B',
              attribution: 'Photo credits',
              attribution_url: 'http://www.trustroots.org/team2',
              image_UUID: '3c8bb9f1-e313-4baa-bf4c-1d8994fd6c6d',
              description: 'Lorem ipsum.',
              count: 5,
            });

            async.each(
              [tribeA, tribeB],
              function (tribe, callback) {
                tribe.save(callback);
              },
              cb,
            );
          },

          // join the tribeA with the removed user
          function (cb) {
            agent
              .post('/api/users/memberships/' + tribeA._id)
              .send()
              .expect(200)
              .end(function (err) {
                cb(err);
              });
          },

          // now the tribeA should have count 6
          function (cb) {
            Tribe.findById(tribeA._id, function (err, tribe) {
              try {
                should(tribe.count).eql(6);
                cb();
              } catch (e) {
                cb(e);
              }
            });
          },

          sendDeleteRequest,

          // tribeA should have lower count by 1 (5 -> 6 -> 5 now)
          function (cb) {
            Tribe.findById(tribeA._id, function (err, tribe) {
              try {
                should(tribe.count).eql(5);
                cb();
              } catch (e) {
                cb(e);
              }
            });
          },

          // tribeB should have count 5 all the time
          function (cb) {
            Tribe.findById(tribeB._id, function (err, tribe) {
              try {
                should(tribe.count).eql(5);
                cb();
              } catch (e) {
                cb(e);
              }
            });
          },
        ],
        done,
      );
    });

    it('should remove hosting offer of the user', function (done) {
      async.waterfall(
        [
          // Create an offer for the user
          function (cb) {
            const offer = new Offer({
              user: userA._id,
              location: [0, 0],
            });

            offer.save(function (err) {
              cb(err);
            });
          },

          // at the beginning 1 offer should exist in database
          function (cb) {
            Offer.find({ user: userA._id }, function (err, offer) {
              try {
                should(offer).length(1);
                cb();
              } catch (e) {
                cb(e);
              }
            });
          },

          sendDeleteRequest,

          // now the offer shouldn't be there
          function (cb) {
            Offer.find({ user: userA._id }, function (err, offers) {
              try {
                should(offers).length(0);
                cb();
              } catch (e) {
                cb(e);
              }
            });
          },
        ],
        done,
      );
    });

    it('should remove contacts of the user', function (done) {
      let userC;

      async.waterfall(
        [
          // create a 3rd user
          function (cb) {
            userC = new User({
              public: true,
              firstName: 'Full',
              lastName: 'Name C',
              displayName: 'Full Name C',
              email: 'user_c@example.com',
              username: 'userc',
              password: '**********asdfasdf',
              provider: 'local',
            });

            userC.save(function (err) {
              cb(err);
            });
          },

          // add contacts between the users
          function (cb) {
            const contactAB = new Contact({
              userFrom: userA._id,
              userTo: userB._id,
              confirmed: true,
            });

            const contactBC = new Contact({
              userFrom: userB._id,
              userTo: userC._id,
              confirmed: true,
            });

            const contactCA = new Contact({
              userFrom: userC._id,
              userTo: userA._id,
              confirmed: false,
            });

            async.each(
              [contactAB, contactBC, contactCA],
              function (contact, callback) {
                contact.save(callback);
              },
              cb,
            );
          },

          // 3 contacts should exist
          function (cb) {
            Contact.find().exec(function (err, contacts) {
              cb(null, contacts);
            });
          },
          function (contacts, cb) {
            try {
              should(contacts).length(3);
              cb();
            } catch (e) {
              cb(e);
            }
          },

          sendDeleteRequest,

          // only 1 contact should exist now (the one between users B and C)
          function (cb) {
            Contact.find().exec(function (err, contacts) {
              cb(null, contacts);
            });
          },

          function (contacts, cb) {
            try {
              should(contacts).length(1);
              cb();
            } catch (e) {
              cb(e);
            }
          },
        ],
        done,
      );
    });
  });
});

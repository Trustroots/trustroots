'use strict';

var fs = require('fs'),
    should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Contact = mongoose.model('Contact'),
    config = require(path.resolve('./config/config')),
    express = require(path.resolve('./config/lib/express')),
    testutils = require(path.resolve('./testutils/server.testutil'));

/**
 * Globals
 */
var app,
    agent,
    credentials_a,
    credentials_b,
    user_a,
    _user_a,
    user_b,
    _user_b;

/**
 * User routes tests
 */
describe('User removal CRUD tests', function () {

  var jobs = testutils.catchJobs();

  before(function (done) {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);

    done();
  });

  // Create an user A

  beforeEach(function (done) {
    // Create user credentials for user A
    credentials_a = {
      username: 'user_a',
      password: 'M3@n.jsI$Aw3$0m3'
    };

    // Create a new user A
    _user_a = {
      public: true,
      firstName: 'Full',
      lastName: 'Name A',
      displayName: 'Full Name A',
      email: 'user_a@example.com',
      username: credentials_a.username.toLowerCase(),
      displayUsername: credentials_a.username,
      password: credentials_a.password,
      provider: 'local'
    };

    user_a = new User(_user_a);

    // Save a user to the test db
    user_a.save(done);
  });

  // Create user B

  beforeEach(function (done) {
    // Create user credentials for user B
    credentials_b = {
      username: 'user_b',
      password: 'M3@n.jsI$Aw3$0m3'
    };

    // Create a new user B
    _user_b = {
      public: true,
      firstName: 'Full',
      lastName: 'Name B',
      displayName: 'Full Name B',
      email: 'user_b@example.com',
      username: credentials_b.username.toLowerCase(),
      displayUsername: credentials_b.username,
      password: credentials_b.password,
      provider: 'local'
    };

    user_b = new User(_user_b);

    // Save a user to the test db
    user_b.save(done);
  });

  it('should not be able to initiate removing profile when not logged in', function (done) {
    agent.del('/api/users')
      .expect(403)
      .end(function (deleteErr) {
        // Handle signup error
        if (deleteErr) {
          return done(deleteErr);
        }

        jobs.length.should.equal(0);

        // User should still exist
        User.findOne({ username: user_a.username }, function(findUsersErr, findUser) {
          if (findUsersErr) {
            return done(findUsersErr);
          }

          findUser.username.should.equal(user_a.username);

          done();
        });
      });
  });

  it('Signin in should not reveal profile removal tokens', function (done) {
    user_a.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    user_a.removeProfileExpires = new Date();

    user_a.save(function (err) {
      should.not.exist(err);

      agent.post('/api/auth/signin')
        .send(credentials_a)
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
    agent.post('/api/auth/signin')
      .send(credentials_a)
      .expect(200)
      .end(function (signinErr, signedInUser) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        agent.del('/api/users')
          .expect(200)
          .end(function (deleteErr, deleteRes) {
            // Handle signup error
            if (deleteErr) {
              return done(deleteErr);
            }

            deleteRes.body.message.should.equal('We sent you an email with further instructions.');

            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal('Confirm removing your Trustroots profile');
            jobs[0].data.to.address.should.equal(_user_a.email);

            User.findById(signedInUser.body._id, function(findUsersErr, findUser) {
              if (findUsersErr) {
                return done(findUsersErr);
              }

              jobs[0].data.text.should.containEql('/remove/' + findUser.removeProfileToken);

              should.exist(findUser.removeProfileExpires);
              should.exist(findUser.removeProfileToken);

              done();
            });
          });
      });
  });

  it('should be able to initiate removing profile when already initiated once earlier', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials_a)
      .expect(200)
      .end(function (signinErr, signedInUser) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        agent.del('/api/users')
          .expect(200)
          .end(function (deleteErr1, deleteRes1) {
            // Handle signup error
            if (deleteErr1) {
              return done(deleteErr1);
            }

            deleteRes1.body.message.should.equal('We sent you an email with further instructions.');

            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal('Confirm removing your Trustroots profile');
            jobs[0].data.to.address.should.equal(_user_a.email);

            User.findById(signedInUser.body._id, function(findUsersErr1, findUser1) {
              if (findUsersErr1) {
                return done(findUsersErr1);
              }

              jobs[0].data.text.should.containEql('/remove/' + findUser1.removeProfileToken);

              should.exist(findUser1.removeProfileExpires);
              should.exist(findUser1.removeProfileToken);

              // Send another delete request
              // This should refresh token to new one so check everything again
              agent.del('/api/users')
                .expect(200)
                .end(function (deleteErr2, deleteRes2) {
                  // Handle signup error
                  if (deleteErr2) {
                    return done(deleteErr2);
                  }

                  deleteRes2.body.message.should.equal('We sent you an email with further instructions.');

                  jobs.length.should.equal(2); // now two because earlier we sent already one
                  jobs[1].type.should.equal('send email');
                  jobs[1].data.subject.should.equal('Confirm removing your Trustroots profile');
                  jobs[1].data.to.address.should.equal(_user_a.email);

                  User.findById(signedInUser.body._id, function(findUsersErr2, findUser2) {
                    if (findUsersErr2) {
                      return done(findUsersErr2);
                    }

                    jobs[1].data.text.should.containEql('/remove/' + findUser2.removeProfileToken);

                    should.exist(findUser2.removeProfileExpires);
                    should.exist(findUser2.removeProfileToken);

                    done();
                  });
                });
            });
          });
      });
  });

  it('should be able to confirm removing profile when signed in', function (done) {

    user_a.removeProfileExpires = Date.now() + (24 * 3600000);
    user_a.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    user_a.save(function (err, savedUser) {
      should.not.exist(err);

      agent.post('/api/auth/signin')
        .send(credentials_a)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.del('/api/users/remove/' + savedUser.removeProfileToken)
            .expect(200)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal('Your profile has been removed.');

              jobs.length.should.equal(1);
              jobs[0].type.should.equal('send email');
              jobs[0].data.subject.should.equal('Your Trustroots profile has been removed');
              jobs[0].data.to.address.should.equal(_user_a.email);
              jobs[0].data.text.should.containEql('Your Trustroots account has been removed.');

              User.findById(savedUser._id, function(findUsersErr, findUser) {
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

  it('should not be able to confirm removing profile when not signed in', function (done) {

    user_a.removeProfileExpires = Date.now() + (24 * 3600000);
    user_a.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    user_a.save(function (err, savedUser) {
      should.not.exist(err);

      agent.del('/api/users/remove/' + savedUser.removeProfileToken)
        .expect(403)
        .end(function (deleteErr, deleteRes) {
          // Handle signup error
          if (deleteErr) {
            return done(deleteErr);
          }

          deleteRes.body.message.should.equal('Forbidden.');

          jobs.length.should.equal(0);

          // User should still exist
          User.findById(savedUser._id, function(findUsersErr, findUser) {
            if (findUsersErr) {
              return done(findUsersErr);
            }

            findUser.removeProfileToken.should.equal(user_a.removeProfileToken);

            done();
          });
        });
    });
  });

  it('should not be able to confirm removing profile with wrong token', function (done) {

    user_a.removeProfileExpires = Date.now() + (24 * 3600000);
    user_a.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    user_a.save(function (err, savedUser) {
      should.not.exist(err);

      agent.post('/api/auth/signin')
        .send(credentials_a)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.del('/api/users/remove/wrongtoken')
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal('Profile remove token is invalid or has expired.');

              jobs.length.should.equal(0);

              // User should still exist
              User.findById(savedUser._id, function(findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                findUser.removeProfileToken.should.equal(user_a.removeProfileToken);

                done();
              });
            });
        });
    });
  });

  it('should not be able to confirm removing profile with expired token', function (done) {

    user_a.removeProfileExpires = Date.now() - (24 * 3600000); // 24h in the past
    user_a.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    user_a.save(function (err, savedUser) {
      should.not.exist(err);

      agent.post('/api/auth/signin')
        .send(credentials_a)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.del('/api/users/remove/' + user_a.removeProfileToken)
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal('Profile remove token is invalid or has expired.');

              jobs.length.should.equal(0);

              // User should still exist
              User.findById(savedUser._id, function(findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                findUser.removeProfileToken.should.equal(user_a.removeProfileToken);

                done();
              });
            });
        });
    });
  });

  it('should not be able to confirm removing profile when signed in as wrong user', function (done) {

    user_a.removeProfileExpires = Date.now() + (24 * 3600000);
    user_a.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    user_a.save(function (err, savedUser) {
      should.not.exist(err);

      agent.post('/api/auth/signin')
        .send(credentials_b) // User B signs in insetead of user A
        .expect(200)
        .end(function (signinErr) {

          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.del('/api/users/remove/' + user_a.removeProfileToken)
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }

              deleteRes.body.message.should.equal('Profile remove token is invalid or has expired.');

              jobs.length.should.equal(0);

              // User should still exist
              User.findById(savedUser._id, function(findUsersErr, findUser) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }

                findUser.removeProfileToken.should.equal(user_a.removeProfileToken);

                // Signed in user should still exist
                User.findOne({ username: user_b.username }, function(findUsersErr, findUser) {
                  if (findUsersErr) {
                    return done(findUsersErr);
                  }

                  findUser.username.should.equal(user_b.username);
                  should.not.exist(user_b.removeProfileExpires);
                  should.not.exist(user_b.removeProfileToken);

                  done();
                });
              });
            });
        });
    });
  });

  it('should remove profile images', function (done) {

    user_a.removeProfileExpires = Date.now() + (24 * 3600000);
    user_a.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';

    user_a.save(function (err, savedUser) {
      should.not.exist(err);

      agent.post('/api/auth/signin')
        .send(credentials_a)
        .expect(200)
        .end(function (signinErr, signinRes) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          // Each user has their own folder for avatars
          var uploadDir = path.resolve(config.uploadDir) + '/' + signinRes.body._id + '/avatar'; // No trailing slash

          // Avatar should now exist
          console.log('testing: ' + uploadDir);
          if (fs.existsSync(uploadDir)) {
            console.log('Exists');
          } else {
            console.log('does not exist');
          }

          // Ensure file doesn't exist before
          /*
          fs.unlink(uploadDir, function (unlinkErr) {
            if (unlinkErr) {
              return done(unlinkErr);
            }

            // Avatar should now exist
            console.log('testing: ' + uploadDir);
            if (fs.existsSync(uploadDir)) {
              console.log('Exists');
            } else {
              console.log('does not exist');
            }

          });
          */

          // Upload avatar image
          agent.post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/avatar.png')
            .expect(200)
            .end(function (userInfoErr) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              // Avatar should now exist
              console.log('testing: ' + uploadDir);
              if (fs.existsSync(uploadDir)) {
                console.log('Exists');
              } else {
                console.log('does not exist');
              }

              agent.del('/api/users/remove/' + savedUser.removeProfileToken)
                .expect(200)
                .end(function (deleteErr, deleteRes) {
                  // Handle signup error
                  if (deleteErr) {
                    return done(deleteErr);
                  }

                  deleteRes.body.message.should.equal('Your profile has been removed.');

                  // Avatar should not exist anymore
                  User.findById(savedUser._id, function(findUsersErr, findUser) {
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
  });

  afterEach(function (done) {
    User.remove().exec(function() {
      Contact.remove().exec(done);
    });
  });
});

const should = require('should');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const moment = require('moment');
const config = require(path.resolve('./config/config'));
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');

/**
 * Globals
 */
let app;
let agent;
let credentials;
let user;
let _user;
let user2;
let _user2;
let unConfirmedCredentials;
let unConfirmedUser;
let _unConfirmedUser;

/**
 * User routes tests
 */
describe('User profile CRUD tests', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  // Create a confirmed user
  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'TR_username',
      password: 'TR-I$Aw3$0m3',
    };

    // Create a new user
    _user = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      username: credentials.username.toLowerCase(),
      password: credentials.password,
      provider: 'local',
      roles: ['user'],
    };

    user = new User(_user);

    // Save a user to the test db
    user.save(done);
  });

  // Create another confirmed user
  beforeEach(function (done) {
    _user2 = {
      public: true,
      firstName: 'Full2',
      lastName: 'Name2',
      displayName: 'Full2 Name2',
      email: 'test2@example.org',
      username: 'tr_username2',
      password: 'TR-I$Aw3$0m3',
      provider: 'local',
      roles: ['user'],
    };
    user2 = new User(_user2);
    user2.save(done);
  });

  // Create an unconfirmed user
  beforeEach(function (done) {
    unConfirmedCredentials = {
      username: 'TR_username_unconfirmed',
      password: 'TR-I$Aw3$0m4',
    };

    _unConfirmedUser = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'unconfirmed-test@example.org',
      emailTemporary: 'unconfirmed-test@example.org', // unconfirmed users have this set
      emailToken: 'initial email token',
      username: unConfirmedCredentials.username.toLowerCase(),
      password: unConfirmedCredentials.password,
      provider: 'local',
      roles: ['user'],
    };

    unConfirmedUser = new User(_unConfirmedUser);

    // Save a user to the test db
    unConfirmedUser.save(done);
  });

  afterEach(utils.clearDatabase);

  it('should be able to get own user details successfully even when profile is still non-public', function (done) {
    agent
      .post('/api/auth/signin')
      .send(unConfirmedCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Get own user details
        agent
          .get('/api/users/' + unConfirmedCredentials.username.toLowerCase())
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            res.body.should.be.instanceof(Object);
            res.body.username.should.equal(unConfirmedUser.username);
            res.body.public.should.equal(false); // Unpublic right after signup
            res.body.avatarSource.should.equal('gravatar'); // Defaults to `gravatar`
            should.exist(res.body.languages);
            should.exist(res.body.gender);
            should.exist(res.body.description);
            should.exist(res.body.tagline);
            should.exist(res.body.avatarUploaded);
            should.exist(res.body.avatarSource);
            should.exist(res.body.created);
            should.exist(res.body.emailHash);
            should.not.exist(res.body.salt);
            should.not.exist(res.body.password);
            should.not.exist(res.body.roles);
            return done();
          });
      });
  });

  it('should be able to get own user details successfully with role "shadowban"', function (done) {
    user.roles = ['user', 'shadowban'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Get own user details
          agent
            .get('/api/users/' + user.username.toLowerCase())
            .expect(200)
            .end(done);
        });
    });
  });

  it('should be able to get other user details successfully when with role "shadowban"', function (done) {
    user.roles = ['user', 'shadowban'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Get their user details
          agent
            .get('/api/users/' + user2.username)
            .expect(200)
            .end(done);
        });
    });
  });

  it('should not be able to get other users details successfully that have "shadowban" role', function (done) {
    user2.roles = ['user', 'shadowban'];

    user2.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Get their user details
          agent
            .get('/api/users/' + user2.username)
            .expect(404)
            .end(done);
        });
    });
  });

  it('should be able to get other users details successfully that have "shadowban" role when with role "moderator"', function (done) {
    user.roles = ['user', 'moderator'];
    user2.roles = ['user', 'shadowban'];

    user.save(function (err) {
      should.not.exist(err);
      user2.save(function (err) {
        should.not.exist(err);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            should.not.exist(signinErr);

            // Get their user details
            agent
              .get('/api/users/' + user2.username)
              .expect(200)
              .end(done);
          });
      });
    });
  });

  it('should be able to get other users details successfully that have "shadowban" role when with role "admin"', function (done) {
    user.roles = ['user', 'admin'];
    user2.roles = ['user', 'shadowban'];

    user.save(function (err) {
      should.not.exist(err);
      user2.save(function (err) {
        should.not.exist(err);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            should.not.exist(signinErr);

            // Get their user details
            agent
              .get('/api/users/' + user2.username)
              .expect(200)
              .end(done);
          });
      });
    });
  });

  it('should be able to see that someone is volunteer when they have "volunteer" role', function (done) {
    user2.roles = ['user', 'volunteer'];

    user2.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Get volunteer's profile
          agent
            .get('/api/users/' + user2.username)
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }

              res.body.isVolunteer.should.be.true();

              // Get non volunteer's profile
              agent
                .get('/api/users/' + user.username)
                .expect(200)
                .end(function (err, res) {
                  if (err) {
                    return done(err);
                  }

                  should.not.exist(res.body.isVolunteer);

                  return done();
                });
            });
        });
    });
  });

  it('should be able to see that someone is volunteer-alumni when they have "volunteer-alumni" role', function (done) {
    user2.roles = ['user', 'volunteer-alumni'];

    user2.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Get volunteer-alumni's profile
          agent
            .get('/api/users/' + user2.username)
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }

              res.body.isVolunteerAlumni.should.be.true();

              // Get non volunteer-alumni's profile
              agent
                .get('/api/users/' + user.username)
                .expect(200)
                .end(function (err, res) {
                  if (err) {
                    return done(err);
                  }

                  should.not.exist(res.body.isVolunteerAlumni);

                  return done();
                });
            });
        });
    });
  });

  it('should not be able to get any user details of confirmed user if not logged in', function (done) {
    // Get own user details
    agent
      .get('/api/users/' + user.username)
      .expect(403)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }

        res.body.message.should.equal('Forbidden.');
        return done();
      });
  });

  it('should not be able to get any user details of un-confirmed user if not logged in', function (done) {
    // Get own user details
    agent
      .get('/api/users/' + unConfirmedUser.username)
      .expect(403)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }

        res.body.message.should.equal('Forbidden.');
        return done();
      });
  });

  it('should be able to update own profile details', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          const userUpdate = {
            firstName: 'user_update_first',
            lastName: 'user_update_last',
          };

          agent
            .put('/api/users')
            .send(userUpdate)
            // .expect(200)
            .end(function (userInfoErr, userInfoRes) {
              if (userInfoErr) {
                return done(userInfoErr);
              }

              // Second time changing it
              userInfoRes.body.should.be.instanceof(Object);
              userInfoRes.body.firstName.should.be.equal('user_update_first');
              userInfoRes.body.lastName.should.be.equal('user_update_last');
              userInfoRes.body._id.should.be.equal(String(user._id));

              // Call the assertion callback
              return done();
            });
        });
    });
  });

  it('should not be able to add roles to own profile', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          const userUpdate = {
            firstName: 'user_update_first',
            lastName: 'user_update_last',
            roles: ['user', 'admin'], // This admin role should not appear in their profile
          };

          agent
            .put('/api/users')
            .send(userUpdate)
            .expect(200)
            .end(function (userInfoErr) {
              should.not.exist(userInfoErr);

              User.findById(user._id, function (err, userFindRes) {
                should.not.exist(userInfoErr);

                userFindRes.firstName.should.be.equal('user_update_first');
                userFindRes.lastName.should.be.equal('user_update_last');
                userFindRes._id.toString().should.be.equal(user._id.toString());
                userFindRes.roles.should.be
                  .instanceof(Array)
                  .and.have.lengthOf(1);
                userFindRes.roles.indexOf('user').should.equal(0);

                return done();
              });
            });
        });
    });
  });

  it('should not be able to update profile details with existing email', function (done) {
    const _user2 = _user;

    _user2.username = 'user2_username';
    _user2.email = 'user2_email@example.org';
    _user2.emailTemporary = 'user2_email@example.org';

    const credentials2 = {
      username: 'username2',
      password: 'TR-I$Aw3$0m4',
    };

    _user2.username = credentials2.username;
    _user2.password = credentials2.password;

    const user2 = new User(_user2);

    user2.save(function (err) {
      should.not.exist(err);

      agent
        .post('/api/auth/signin')
        .send(credentials2)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          const userUpdate = {
            firstName: 'user_update_first',
            lastName: 'user_update_last',
            email: user.email,
          };

          agent
            .put('/api/users')
            .send(userUpdate)
            .expect(403)
            .end(function (userInfoErr, userInfoRes) {
              if (userInfoErr) {
                return done(userInfoErr);
              }

              // Call the assertion callback
              userInfoRes.body.message.should.equal(
                'This email is already in use. Please use another one.',
              );

              return done();
            });
        });
    });
  });

  it('should not be able to update profile if not logged-in', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);

      const userUpdate = {
        firstName: 'user_update_first',
        lastName: 'user_update_last',
      };

      agent
        .put('/api/users')
        .send(userUpdate)
        .expect(403)
        .end(function (userInfoErr, userInfoRes) {
          if (userInfoErr) {
            return done(userInfoErr);
          }

          userInfoRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done();
        });
    });
  });

  describe('Profile picture tests', function () {
    it('should not be able to update profile picture without being logged-in', function (done) {
      agent
        .post('/api/users-avatar')
        .send({})
        .expect(403)
        .end(function (userInfoErr, userInfoRes) {
          if (userInfoErr) {
            return done(userInfoErr);
          }

          userInfoRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to change profile picture to a jpg file when logged-in', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/avatar.jpg')
            .expect(200)
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Avatar image uploaded.');

              return done();
            });
        });
    });

    it('should be able to change profile picture to a gif file when logged-in', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/avatar.gif')
            .expect(200)
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Avatar image uploaded.');

              return done();
            });
        });
    });

    it('should be able to change profile picture to a png file when logged-in', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/avatar.png')
            .expect(200)
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Avatar image uploaded.');

              return done();
            });
        });
    });

    it('should not be able to change profile picture if attach a picture with a different field name', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach(
              'fieldThatDoesntWork',
              './modules/users/tests/server/img/avatar.jpg',
            )
            .expect(400)
            .end(function (userInfoErr, userInfoRes) {
              userInfoRes.body.message.should.equal(
                'Missing "avatar" field from the API call.',
              );
              done(userInfoErr);
            });
        });
    });

    it('should not be able to change profile picture to a pdf file', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/test.pdf')
            .expect(415)
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Unsupported Media Type.');

              return done();
            });
        });
    });

    it('should not be able to change profile picture to a pdf file disguised as jpg file', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach(
              'avatar',
              './modules/users/tests/server/img/test-actually-pdf-looks-like-jpg.jpg',
            )
            .expect(415)
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Unsupported Media Type.');

              return done();
            });
        });
    });

    it('should not be able to change profile picture to a svg file', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/test.svg')
            .expect(415)
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Unsupported Media Type.');

              return done();
            });
        });
    });

    it('should not be able to change profile picture to a text file with jpg extension', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach(
              'avatar',
              './modules/users/tests/server/img/this-is-text-file.jpg',
            )
            .expect(415) // 415: Unsupported Media Type.
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Unsupported Media Type.');

              return done();
            });
        });
    });

    it('should not be able to change profile picture to a too big file', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/users-avatar')
            .attach(
              'avatar',
              './modules/users/tests/server/img/too-big-file.png',
            )
            .expect(413)
            .end(function (userInfoErr, userInfoRes) {
              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal(
                'Image too big. Please maximum ' +
                  (config.maxUploadSize / (1024 * 1024)).toFixed(2) +
                  ' Mb files.',
              );

              return done();
            });
        });
    });
  });

  describe('Username change', function () {
    it('should not let a new user to change username', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err) {
          if (err) {
            return done(err);
          }
          const user2 = _user;
          user2.username = _user.username + '01';
          delete user2.email;
          agent
            .put('/api/users')
            .send(user2)
            .expect(403)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }
              res.body.message.should.equal(
                'You cannot change your username at this time.',
              );
              return done();
            });
        });
    });

    it('should allow changing username for users created 3 months ago who never changed their username', function (done) {
      const threeMonthsAgo = moment(user.created)
        .subtract(3, 'months')
        .toDate();
      user.update({ $set: { created: threeMonthsAgo } }, function (err) {
        should.not.exist(err);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            const user2 = _user;
            user2.username = _user.username + '01';
            delete user2.email;
            agent
              .put('/api/users')
              .send(user2)
              .expect(200)
              .end(function (err, res) {
                if (err) {
                  return done(err);
                }
                res.body.username.should.equal(user2.username);
                return done();
              });
          });
      });
    });

    it('should not be able to change username if username was changed within previous 3 months', function (done) {
      const threeMonthsAgo = moment(user.created)
        .subtract(3, 'months')
        .toDate();
      user.update({ $set: { created: threeMonthsAgo } }, function (err) {
        should.not.exist(err);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            const user2 = _user;
            user2.username = _user.username + '01';
            delete user2.email;
            // First username change
            // First we're setting usernameUpdate
            // This should succeed
            agent
              .put('/api/users')
              .send(user2)
              .expect(200)
              .end(function (err, res) {
                if (err) {
                  return done(err);
                }
                res.body.username.should.equal(user2.username);
                user2.username = _user.username + '02';
                // Second username change for the same user
                // Then we're testing that previous usernameUpdate prevents further changes
                // This should fail
                agent
                  .put('/api/users')
                  .send(user2)
                  .end(function (err, res) {
                    if (err) {
                      return done(err);
                    }
                    res.body.message.should.equal(
                      'You cannot change your username at this time.',
                    );
                    return done();
                  });
              });
          });
      });
    });

    it('should be able to change username if username was changed more than 3 months ago', function (done) {
      const threeMonthsAgo = moment(user.created)
        .subtract(3, 'months')
        .toDate();
      user.update({ $set: { created: threeMonthsAgo } }, function (err) {
        should.not.exist(err);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            // First change
            const user2 = _user;
            user2.username = _user.username + '01';
            delete user2.email;
            agent
              .put('/api/users')
              .send(user2)
              .expect(200)
              .end(function (err, res) {
                if (err) {
                  return done(err);
                }
                res.body.username.should.equal(user2.username);
                User.findById(user._id, function (err, user) {
                  if (err) {
                    return done(err);
                  }
                  const threeMonthsAgo = moment(user.usernameUpdated)
                    .subtract(3, 'months')
                    .toDate();
                  user.update(
                    { $set: { usernameUpdated: threeMonthsAgo } },
                    function (err) {
                      if (err) {
                        return done(err);
                      }
                      // Second time changing it
                      user2.username = _user.username + '02';
                      agent
                        .put('/api/users')
                        .send(user2)
                        .end(function (err, res) {
                          if (err) {
                            return done(err);
                          }
                          res.body.username.should.equal(user2.username);
                          return done();
                        });
                    },
                  );
                });
              });
          });
      });
    });

    it('should not be allowed to change the usernameUpdateAllowed status', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err) {
          if (err) {
            return done(err);
          }
          agent
            .put('/api/users')
            .send({
              usernameUpdateAllowed: true,
            })
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }

              res.body.usernameUpdateAllowed.should.equal(false);

              User.findOne(
                { username: credentials.username },
                function (err, newUser) {
                  should.not.exist(newUser.usernameUpdateAllowed);
                  done(err);
                },
              );
            });
        });
    });

    it('should not be allowed to change the date when their username was last changed', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err) {
          if (err) {
            return done(err);
          }
          agent
            .put('/api/users')
            .send({
              usernameUpdated: moment().subtract(3, 'months').toDate(),
            })
            .expect(200)
            .end(function (err) {
              if (err) {
                return done(err);
              }
              User.findOne(
                { username: credentials.username },
                function (err, newUser) {
                  should.not.exist(newUser.usernameUpdated);
                  done(err);
                },
              );
            });
        });
    });
  });
});

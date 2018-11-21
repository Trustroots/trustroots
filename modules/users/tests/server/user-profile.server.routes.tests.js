'use strict';

var should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    moment = require('moment'),
    User = mongoose.model('User'),
    config = require(path.resolve('./config/config')),
    express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
var app,
    agent,
    credentials,
    user,
    _user,
    unConfirmedCredentials,
    unConfirmedUser,
    _unConfirmedUser;

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
      password: 'TR-I$Aw3$0m3'
    };

    // Create a new user
    _user = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      username: credentials.username.toLowerCase(),
      displayUsername: credentials.username,
      password: credentials.password,
      provider: 'local'
    };

    user = new User(_user);

    // Save a user to the test db
    user.save(done);
  });

  // Create an unconfirmed user
  beforeEach(function (done) {

    unConfirmedCredentials = {
      username: 'TR_username_unconfirmed',
      password: 'TR-I$Aw3$0m4'
    };

    _unConfirmedUser = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'unconfirmed-test@example.org',
      emailTemporary: 'unconfirmed-test@example.org', // unconfirmed users have this set
      emailToken: 'initial email token',
      username: unConfirmedCredentials.username.toLowerCase(),
      displayUsername: unConfirmedCredentials.username,
      password: unConfirmedCredentials.password,
      provider: 'local'
    };

    unConfirmedUser = new User(_unConfirmedUser);

    // Save a user to the test db
    unConfirmedUser.save(done);
  });

  it('should be able to get own user details successfully even when profile is still non-public', function (done) {
    agent.post('/api/auth/signin')
      .send(unConfirmedCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Get own user details
        agent.get('/api/users/' + unConfirmedCredentials.username.toLowerCase())
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            res.body.should.be.instanceof(Object);
            res.body.username.should.equal(unConfirmedUser.username);
            res.body.displayUsername.should.equal(unConfirmedUser.displayUsername);
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
            return done();
          });
      });
  });

  it('should not be able to get any user details of confirmed user if not logged in', function (done) {
    // Get own user details
    agent.get('/api/users/' + user.username)
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
    agent.get('/api/users/' + unConfirmedUser.username)
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          var userUpdate = {
            firstName: 'user_update_first',
            lastName: 'user_update_last'
          };

          agent.put('/api/users')
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
              userInfoRes.body.roles.should.be.instanceof(Array).and.have.lengthOf(1);
              userInfoRes.body.roles.indexOf('user').should.equal(0);
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          var userUpdate = {
            firstName: 'user_update_first',
            lastName: 'user_update_last',
            roles: ['user', 'admin']
          };

          agent.put('/api/users')
            .send(userUpdate)
            .expect(200)
            .end(function (userInfoErr, userInfoRes) {
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.should.be.instanceof(Object);
              userInfoRes.body.firstName.should.be.equal('user_update_first');
              userInfoRes.body.lastName.should.be.equal('user_update_last');
              userInfoRes.body.roles.should.be.instanceof(Array).and.have.lengthOf(1);
              userInfoRes.body.roles.indexOf('user').should.equal(0);
              userInfoRes.body._id.should.be.equal(String(user._id));

              // Call the assertion callback
              return done();
            });
        });
    });
  });

  it('should not be able to update profile details with existing email', function (done) {

    var _user2 = _user;

    _user2.username = 'user2_username';
    _user2.email = 'user2_email@example.org';
    _user2.emailTemporary = 'user2_email@example.org';

    var credentials2 = {
      username: 'username2',
      password: 'TR-I$Aw3$0m4'
    };

    _user2.username = credentials2.username;
    _user2.password = credentials2.password;

    var user2 = new User(_user2);

    user2.save(function (err) {
      should.not.exist(err);

      agent.post('/api/auth/signin')
        .send(credentials2)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          var userUpdate = {
            firstName: 'user_update_first',
            lastName: 'user_update_last',
            email: user.email
          };

          agent.put('/api/users')
            .send(userUpdate)
            .expect(403)
            .end(function (userInfoErr, userInfoRes) {
              if (userInfoErr) {
                return done(userInfoErr);
              }

              // Call the assertion callback
              userInfoRes.body.message.should.equal('This email is already in use. Please use another one.');

              return done();
            });
        });
    });
  });

  it('should not be able to update profile if not logged-in', function (done) {
    user.roles = ['user'];

    user.save(function (err) {

      should.not.exist(err);

      var userUpdate = {
        firstName: 'user_update_first',
        lastName: 'user_update_last'
      };

      agent.put('/api/users')
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

      agent.post('/api/users-avatar')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
            .attach('fieldThatDoesntWork', './modules/users/tests/server/img/avatar.jpg')
            .expect(400)
            .end(function (userInfoErr, userInfoRes) {
              userInfoRes.body.message.should.equal('Missing `avatar` field from the API call.');
              done(userInfoErr);
            });
        });
    });

    it('should not be able to change profile picture to a pdf file', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/test-actually-pdf-looks-like-jpg.jpg')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/this-is-text-file.jpg')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/users-avatar')
            .attach('avatar', './modules/users/tests/server/img/too-big-file.png')
            .expect(413)
            .end(function (userInfoErr, userInfoRes) {

              // Handle change profile picture error
              if (userInfoErr) {
                return done(userInfoErr);
              }

              userInfoRes.body.message.should.equal('Image too big. Please maximum ' + (config.maxUploadSize / (1024 * 1024)).toFixed(2) + ' Mb files.');

              return done();
            });
        });
    });
  });

  describe('Username change', function () {
    it('should not let a new user to change username', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err) {
          if (err) {
            return done(err);
          }
          var user2 = _user;
          user2.username = _user.username + '01';
          delete user2.email;
          agent.put('/api/users')
            .send(user2)
            .expect(403)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }
              res.body.message.should.equal('You cannot change your username at this time.');
              return done();
            });
        });
    });

    it('should allow changing username for users created 3 months ago who never changed their username', function (done) {
      var threeMonthsAgo = moment(user.created)
        .subtract(3, 'months')
        .toDate();
      user.update({ $set: { created: threeMonthsAgo } }, function (err) {
        should.not.exist(err);
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            var user2 = _user;
            user2.username = _user.username + '01';
            delete user2.email;
            agent.put('/api/users')
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

    it('should not be able to change username if username was changed within previous 3 months',
      function (done) {
        var threeMonthsAgo = moment(user.created)
          .subtract(3, 'months')
          .toDate();
        user.update({ $set: { created: threeMonthsAgo } }, function (err) {
          should.not.exist(err);
          agent.post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (err) {
              if (err) {
                return done(err);
              }
              var user2 = _user;
              user2.username = _user.username + '01';
              delete user2.email;
              // First username change
              // First we're setting usernameUpdate
              // This should succeed
              agent.put('/api/users')
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
                  agent.put('/api/users')
                    .send(user2)
                    .end(function (err, res) {
                      if (err) {
                        return done(err);
                      }
                      res.body.message.should.equal('You cannot change your username at this time.');
                      return done();
                    });
                });
            });
        });
      });

    it('should be able to change username if username was changed more than 3 months ago',
      function (done) {
        var threeMonthsAgo = moment(user.created)
          .subtract(3, 'months')
          .toDate();
        user.update({ $set: { created: threeMonthsAgo } }, function (err) {
          should.not.exist(err);
          agent.post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (err) {
              if (err) {
                return done(err);
              }
              // First change
              var user2 = _user;
              user2.username = _user.username + '01';
              delete user2.email;
              agent.put('/api/users')
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
                    var threeMonthsAgo = moment(user.usernameUpdated)
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
                        agent.put('/api/users')
                          .send(user2)
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
            });
        });
      });

    it('should not be allowed to change the usernameUpdateAllowed status',
      function (done) {
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            agent.put('/api/users')
              .send({
                usernameUpdateAllowed: true
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
                  });
              });
          });
      });

    it('should not be allowed to change the date when their username was last changed',
      function (done) {
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            agent.put('/api/users')
              .send({
                usernameUpdated: moment().subtract(3, 'months').toDate()
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
                  });
              });
          });
      });
  });

  afterEach(function (done) {
    User.remove().exec(done);
  });
});

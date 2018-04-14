'use strict';

var should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    semver = require('semver'),
    User = mongoose.model('User'),
    Tag = mongoose.model('Tag'),
    inviteCodeService = require(path.resolve('./modules/users/server/services/invite-codes.server.service')),
    config = require(path.resolve('./config/config')),
    express = require(path.resolve('./config/lib/express')),
    testutils = require(path.resolve('./testutils/server.testutil'));

/**
 * Globals
 */
var app,
    agent,
    credentials,
    user,
    _user,
    confirmedCredentials,
    confirmedUser,
    _confirmedUser;

/**
 * User routes tests
 */
describe('User CRUD tests', function () {

  var jobs = testutils.catchJobs();

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection.db);
    agent = request.agent(app);

    done();
  });

  // Create an unconfirmed user

  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'TR_username',
      password: 'M3@n.jsI$Aw3$0m3'
    };

    // Create a new user
    _user = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      emailTemporary: 'test@test.com', // unconfirmed users have this set
      emailToken: 'initial email token',
      username: credentials.username.toLowerCase(),
      displayUsername: credentials.username,
      password: credentials.password,
      provider: 'local'
    };

    user = new User(_user);

    // Save a user to the test db
    user.save(done);
  });

  // Create a confirmed user

  beforeEach(function (done) {

    confirmedCredentials = {
      username: 'TR_username_confirmed',
      password: 'M3@n.jsI$Aw3$0m4'
    };

    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'confirmed-test@test.com',
      username: confirmedCredentials.username.toLowerCase(),
      displayUsername: confirmedCredentials.username,
      password: confirmedCredentials.password,
      provider: 'local'
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    confirmedUser.save(done);
  });

  it('should be able to register a new user', function (done) {

    _user.username = 'Register_New_User';
    _user.email = 'register_new_user_@test.com';

    agent.post('/api/auth/signup')
      .send(_user)
      .expect(200)
      .end(function (signupErr, signupRes) {
        // Handle signup error
        if (signupErr) {
          return done(signupErr);
        }
        signupRes.body.username.should.equal(_user.username.toLowerCase());
        signupRes.body.username.should.not.equal(_user.username);
        signupRes.body.displayUsername.should.equal(_user.username);
        signupRes.body.email.should.equal(_user.email);
        signupRes.body.emailTemporary.should.equal(_user.email);
        signupRes.body.provider.should.equal('local');
        signupRes.body.public.should.equal(false);
        signupRes.body.created.should.not.be.empty();
        should.not.exist(signupRes.body.updated);
        // Sensitive information should be not sent to the client
        should.not.exist(signupRes.body.emailToken);
        should.not.exist(signupRes.body.password);
        should.not.exist(signupRes.body.salt);
        // Assert we have just the default 'user' role
        signupRes.body.roles.should.be.instanceof(Array).and.have.lengthOf(1);
        signupRes.body.roles.indexOf('user').should.equal(0);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal('Confirm Email');
        jobs[0].data.to.address.should.equal(_user.email);

        done();
      });
  });

  it('should be able to register a new user and confirm email with token and user should become public', function (done) {

    _user.username = 'Register_New_User';
    _user.email = 'register_new_user_@test.com';

    agent.post('/api/auth/signup')
      .send(_user)
      .expect(200)
      .end(function (signupErr, signupRes) {
        // Handle signup error
        if (signupErr) {
          return done(signupErr);
        }

        signupRes.body.public.should.equal(false);
        should.not.exist(signupRes.body.emailToken);
        should.not.exist(signupRes.body.password);
        should.not.exist(signupRes.body.salt);
        signupRes.body.emailTemporary.should.equal(_user.email);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal('Confirm Email');
        jobs[0].data.to.address.should.equal(_user.email);

        User.findOne({ username: _user.username.toLowerCase() }, function (err, userRes1) {
          if (err) {
            return done(err);
          }

          userRes1.public.should.equal(false);
          userRes1.email.should.not.be.empty();
          userRes1.emailToken.should.not.be.empty();

          // GET should give us redirect
          agent.get('/api/auth/confirm-email/' + userRes1.emailToken)
            .expect(302)
            .end(function (confirmEmailPostErr, confirmEmailGetRes) {
              if (confirmEmailPostErr) {
                return done(confirmEmailPostErr);
              }

              confirmEmailGetRes.text.should.equal(redirectMessage('/confirm-email/' + userRes1.emailToken));

              // POST does the actual job
              agent.post('/api/auth/confirm-email/' + userRes1.emailToken)
                .expect(200)
                .end(function (confirmEmailPostErr, confirmEmailPostRes) {
                  if (confirmEmailPostErr) {
                    return done(confirmEmailPostErr);
                  }

                  jobs.length.should.equal(1);
                  jobs[0].type.should.equal('send email');

                  // User should now be public
                  confirmEmailPostRes.body.profileMadePublic.should.equal(true);
                  confirmEmailPostRes.body.user.public.should.equal(true);
                  confirmEmailPostRes.body.user.emailTemporary.should.be.empty();

                  // Sensitive information should be not sent to the client
                  should.not.exist(confirmEmailPostRes.body.user.emailToken);
                  should.not.exist(confirmEmailPostRes.body.user.password);
                  should.not.exist(confirmEmailPostRes.body.user.salt);

                  return done();
                });
            });
        });
      });
  });

  it('should be able to register a new user and confirming email with wrong token should redirect error and yeld an error and user should not be public', function (done) {

    _user.username = 'Register_New_User';
    _user.email = 'register_new_user_@test.com';

    agent.post('/api/auth/signup')
      .send(_user)
      .expect(200)
      .end(function (signupErr, signupRes) {
        // Handle signup error
        if (signupErr) {
          return done(signupErr);
        }

        signupRes.body.public.should.equal(false);
        should.not.exist(signupRes.body.emailToken);
        should.not.exist(signupRes.body.password);
        should.not.exist(signupRes.body.salt);
        signupRes.body.emailTemporary.should.equal(_user.email);

        User.findOne({ username: _user.username.toLowerCase() }, function (err, userRes1) {
          if (err) {
            return done(err);
          }

          userRes1.public.should.equal(false);
          userRes1.email.should.not.be.empty();
          userRes1.emailToken.should.not.be.empty();

          // GET should give us redirect
          agent.get('/api/auth/confirm-email/WRONG_TOKEN')
            .expect(302)
            .end(function (confirmEmailPostErr, confirmEmailGetRes) {
              if (confirmEmailPostErr) {
                return done(confirmEmailPostErr);
              }

              confirmEmailGetRes.text.should.equal(redirectMessage('/confirm-email-invalid'));

              // POST does the actual job
              agent.post('/api/auth/confirm-email/WRONG_TOKEN')
                .expect(400)
                .end(function (confirmEmailPostErr, confirmEmailPostRes) {
                  if (confirmEmailPostErr) {
                    return done(confirmEmailPostErr);
                  }

                  confirmEmailPostRes.body.message.should.equal('Email confirm token is invalid or has expired.');

                  return done();
                });
            });
        });
      });
  });

  it('should be able to login successfully using username and logout successfully', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr, signinRes) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Sensitive information should be not sent to the client
        should.not.exist(signinRes.body.emailToken);
        should.not.exist(signinRes.body.password);
        should.not.exist(signinRes.body.salt);

        // Logout
        agent.get('/api/auth/signout')
          .expect(302)
          .end(function (signoutErr, signoutRes) {
            if (signoutErr) {
              return done(signoutErr);
            }

            signoutRes.redirect.should.equal(true);
            signoutRes.text.should.equal(redirectMessage('/'));

            return done();
          });
      });
  });

  it('should be able to login successfully using email and logout successfully', function (done) {

    // In place of username, we can send an email
    var emailCredentials = credentials;
    emailCredentials.username = 'test@test.com';

    agent.post('/api/auth/signin')
      .send(emailCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Logout
        agent.get('/api/auth/signout')
          .expect(302)
          .end(function (signoutErr, signoutRes) {
            if (signoutErr) {
              return done(signoutErr);
            }

            signoutRes.redirect.should.equal(true);
            signoutRes.text.should.equal(redirectMessage('/'));

            return done();
          });
      });
  });

  it('should not be able to login successfully if user has "suspended" role', function (done) {
    user.roles = ['user', 'suspended'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(403)
        .end(function (signinErr, signinRes) {

          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          signinRes.body.message.should.equal('Your account has been suspended.');

          return done();
        });
    });
  });

  it('should invalidate sessions of authenticated user with "suspended" role and return error for json requests', function (done) {

    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Suspend user
        user.roles = ['user', 'suspended'];
        user.save(function (userSaveErr) {
          if (userSaveErr) {
            return done(userSaveErr);
          }

          // Load some json from API, get 403 suspended error
          agent.get('/api/users/' + user.username)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function (err, res) {
            // Handle error
              if (err) {
                return done(err);
              }

              res.body.message.should.equal('Your account has been suspended.');

              // Load some json from API again,
              // get normal 403 forbidden error since session is now destroyed
              agent.get('/api/users/' + user.username)
                .expect(403)
                .end(function (err, res) {
                  // Handle error
                  if (err) {
                    return done(err);
                  }

                  res.body.message.should.equal('Forbidden.');

                  return done();
                });

            });
        });

      });
  });

  it('should invalidate sessions of authenticated user with "suspended" role and return error page for text/html requests', function (done) {

    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Suspend user
        user.roles = ['user', 'suspended'];
        user.save(function (userSaveErr) {
          if (userSaveErr) {
            return done(userSaveErr);
          }

          // Load html page
          agent.get('/')
            .set('Accept', 'text/html')
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(403)
            .end(function (err, res) {
            // Handle error
              if (err) {
                return done(err);
              }

              // Note how we check for `res.text` instead of `res.body`
              res.text.should.containEql('Your account has been suspended.');

              // Load some html again,
              // get normal 200 since session is now destroyed
              agent.get('/')
                .set('Accept', 'text/html')
                .expect(200)
                .end(function (err) {
                  // Handle error
                  if (err) {
                    return done(err);
                  }

                  return done();
                });

            });
        });

      });
  });

  context('logged in as a confirmed user', function () {

    beforeEach(function (done) {
      agent.post('/api/auth/signin')
        .send(confirmedCredentials)
        .expect(200)
        .end(function (err, signinRes) {
          if (err) return done(err);
          // Sanity check they are confirmed
          signinRes.body.public.should.equal(true);
          done();
        });
    });

    it('should not resend confirmation token', function (done) {
      agent.post('/api/auth/resend-confirmation')
        .expect(400)
        .end(function (err, resendRes) {
          if (err) return done(err);
          resendRes.body.message.should.equal('Already confirmed.');
          done();
        });
    });

    context('with changed email address', function () {

      beforeEach(function (done) {
        confirmedUser.emailTemporary = 'confirmed-test-changed@test.com';
        confirmedUser.save(done);
      });

      it('should resend confirmation token for email change', function (done) {

        agent.post('/api/auth/resend-confirmation')
          .expect(200)
          .end(function (err, resendRes) {
            if (err) return done(err);
            resendRes.body.message.should.equal('Sent confirmation email.');
            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal('Confirm email change');
            jobs[0].data.to.address.should.equal('confirmed-test-changed@test.com');
            done();
          });

      });

    });

  });

  context('logged in as unconfirmed user', function () {

    beforeEach(function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err, signinRes) {
          if (err) return done(err);
          // Sanity check they are unconfirmed
          signinRes.body.public.should.equal(false);
          done();
        });
    });

    it('should resend confirmation token', function (done) {
      agent.post('/api/auth/resend-confirmation')
        .expect(200)
        .end(function (err, resendRes) {
          if (err) return done(err);
          resendRes.body.message.should.equal('Sent confirmation email.');
          User.findOne(
            { username: _user.username.toLowerCase() },
            'emailToken',
            function (err, userRes) {
              if (err) return done(err);
              should.exist(userRes);
              should.exist(userRes.emailToken);
              // Make sure it has changed from the original value
              userRes.emailToken.should.not.equal(_user.emailToken);
              jobs.length.should.equal(1);
              jobs[0].type.should.equal('send email');
              jobs[0].data.subject.should.equal('Confirm Email');
              jobs[0].data.to.address.should.equal(_user.emailTemporary);
              done();
            });
        });
    });

  });

  it('forgot password should return 400 for non-existent username', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: 'some_username_that_doesnt_exist'
        })
        .expect(404)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.equal('We could not find an account with that username or email. Make sure you have it spelled correctly.');
          return done();
        });
    });
  });

  it('forgot password should return 400 for no username provided', function (done) {
    var provider = 'facebook';
    user.provider = provider;
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: ''
        })
        .expect(400)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.equal('Please, we really need your username or email first...');
          return done();
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using username', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: user.username
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal('We sent you an email with further instructions.');

          User.findOne({ username: user.username.toLowerCase() }, function (err, userRes) {
            userRes.resetPasswordToken.should.not.be.empty();
            should.exist(userRes.resetPasswordExpires);
            return done();
          });
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using uppercase username', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: user.username.toUpperCase()
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal('We sent you an email with further instructions.');

          User.findOne({ username: user.username.toLowerCase() }, function (err, userRes) {
            userRes.resetPasswordToken.should.not.be.empty();
            should.exist(userRes.resetPasswordExpires);
            return done();
          });
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using email', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: user.email
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal('We sent you an email with further instructions.');

          User.findOne({ email: user.email.toLowerCase() }, function (err, userRes) {
            userRes.resetPasswordToken.should.not.be.empty();
            should.exist(userRes.resetPasswordExpires);
            return done();
          });
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using uppercase email', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: user.email.toUpperCase()
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal('We sent you an email with further instructions.');

          User.findOne({ email: user.email.toLowerCase() }, function (err, userRes) {
            userRes.resetPasswordToken.should.not.be.empty();
            should.exist(userRes.resetPasswordExpires);
            return done();
          });
        });
    });
  });

  it('forgot password should be able to reset the password using reset token', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: user.username
        })
        .expect(200)
        .end(function (err) {
          // Handle error
          if (err) {
            return done(err);
          }

          User.findOne({ username: user.username.toLowerCase() }, function (err, userRes) {
            userRes.resetPasswordToken.should.not.be.empty();
            should.exist(userRes.resetPasswordExpires);
            agent.get('/api/auth/reset/' + userRes.resetPasswordToken)
              .expect(302)
              .end(function (err, res) {
              // Handle error
                if (err) {
                  return done(err);
                }
                res.headers.location.should.be.equal('/password/reset/' + userRes.resetPasswordToken);
                return done();
              });
          });
        });
    });
  });


  it('forgot password should return error when using invalid reset token', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent.post('/api/auth/forgot')
        .send({
          username: user.username
        })
        .expect(200)
        .end(function (err) {
          // Handle error
          if (err) {
            return done(err);
          }

          var invalidToken = 'someTOKEN1234567890';
          agent.get('/api/auth/reset/' + invalidToken)
            .expect(302)
            .end(function (err, res) {
            // Handle error
              if (err) {
                return done(err);
              }

              res.headers.location.should.be.equal('/password/reset/invalid');

              return done();
            });
        });
    });
  });

  it('should be able to change user own password successfully', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent.post('/api/users/password')
          .send({
            newPassword: '1234567890Aa$',
            verifyPassword: '1234567890Aa$',
            currentPassword: credentials.password
          })
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            res.body.message.should.equal('Password changed successfully!');
            return done();
          });
      });
  });

  it('should not be able to change user own password if wrong verifyPassword is given', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent.post('/api/users/password')
          .send({
            newPassword: '1234567890Aa$',
            verifyPassword: '1234567890-ABC-123-Aa$',
            currentPassword: credentials.password
          })
          .expect(400)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            res.body.message.should.equal('Passwords do not match.');
            return done();
          });
      });
  });

  it('should not be able to change user own password if wrong currentPassword is given', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent.post('/api/users/password')
          .send({
            newPassword: '1234567890Aa$',
            verifyPassword: '1234567890Aa$',
            currentPassword: 'some_wrong_passwordAa$'
          })
          .expect(400)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            res.body.message.should.equal('Current password is incorrect.');
            return done();
          });
      });
  });

  it('should not be able to change user own password if no new password is at all given', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent.post('/api/users/password')
          .send({
            newPassword: '',
            verifyPassword: '',
            currentPassword: credentials.password
          })
          .expect(400)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            res.body.message.should.equal('Please provide a new password.');
            return done();
          });
      });
  });

  it('should not be able to change user own password if no new password is at all given', function (done) {

    // Change password
    agent.post('/api/users/password')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
        currentPassword: credentials.password
      })
      .expect(403)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }

        res.body.message.should.equal('Forbidden.');
        return done();
      });
  });

  it('should be able to get own user details successfully even when profile is still non-public', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Get own user details
        agent.get('/api/users/' + credentials.username.toLowerCase())
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            res.body.should.be.instanceof(Object);
            res.body.username.should.equal(user.username);
            res.body.displayUsername.should.equal(user.displayUsername);
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

  it('should not be able to get any user details if not logged in', function (done) {
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

  it('should be able to update own user details', function (done) {
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

  it('should not be able to update own user details and add roles', function (done) {
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

  it('should not be able to update own user details with existing email', function (done) {

    var _user2 = _user;

    _user2.username = 'user2_username';
    _user2.email = 'user2_email@test.com';
    _user2.emailTemporary = 'user2_email@test.com';

    var credentials2 = {
      username: 'username2',
      password: 'M3@n.jsI$Aw3$0m3'
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

  it('should not be able to update own user details if not logged-in', function (done) {
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

  it('should not be able to update own user profile picture without being logged-in', function (done) {

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

  it('should be able to join a tribe with "is" relation', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        var tribe = new Tag({
          label: 'Awesome Tribe',
          tribe: true
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          agent.post('/api/users/memberships')
            .send({
              id: tribe._id,
              relation: 'is'
            })
            .expect(200)
            .end(function (userTagErr, userTagRes) {

              // Handle joining tag error
              if (userTagErr) {
                return done(userTagErr);
              }

              // Confirmation message
              userTagRes.body.message.should.be.equal('Joined tribe.');

              // It should return correct tribe with new count
              userTagRes.body.tag._id.should.be.equal(tribe._id.toString());
              userTagRes.body.tag.count.should.be.equal(1);
              userTagRes.body.tag.label.should.be.equal('Awesome Tribe');
              userTagRes.body.tag.slug.should.be.equal('awesome-tribe');
              should.exist(userTagRes.body.tag.color);

              // It should return updated user
              userTagRes.body.user.username.should.be.equal(credentials.username.toLowerCase());
              userTagRes.body.user.memberIds[0].should.be.equal(tribe._id.toString());
              userTagRes.body.user.member[0].tag.should.be.equal(tribe._id.toString());
              userTagRes.body.user.member[0].relation.should.be.equal('is');
              should.exist(userTagRes.body.user.member[0].since);

              return done();
            });
        });
      });
  });

  it('should be able to join a tribe with "likes" relation', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        var tribe = new Tag({
          label: 'Awesome Tribe',
          tribe: true
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          agent.post('/api/users/memberships')
            .send({
              id: tribe._id,
              relation: 'likes'
            })
            .expect(200)
            .end(function (userTagErr, userTagRes) {

              // Handle joining tag error
              if (userTagErr) {
                return done(userTagErr);
              }

              // Confirmation message
              userTagRes.body.message.should.be.equal('Joined tribe.');

              // It should return correct tribe with new count
              userTagRes.body.tag._id.should.be.equal(tribe._id.toString());
              userTagRes.body.tag.count.should.be.equal(1);
              userTagRes.body.tag.label.should.be.equal('Awesome Tribe');
              userTagRes.body.tag.slug.should.be.equal('awesome-tribe');
              should.exist(userTagRes.body.tag.color);

              // It should return updated user
              userTagRes.body.user.username.should.be.equal(credentials.username.toLowerCase());
              userTagRes.body.user.memberIds[0].should.be.equal(tribe._id.toString());
              userTagRes.body.user.member[0].tag.should.be.equal(tribe._id.toString());
              userTagRes.body.user.member[0].relation.should.be.equal('likes');
              should.exist(userTagRes.body.user.member[0].since);

              return done();
            });
        });
      });
  });

  it('should be able to leave tribe', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        var tribe = new Tag({
          label: 'Hitchhikers',
          tribe: true
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          agent.post('/api/users/memberships')
            .send({
              id: tribe._id,
              relation: 'is'
            })
            .expect(200)
            .end(function (userTagJoinErr, userTagJoinRes) {

              // Handle joining tag error
              if (userTagJoinErr) {
                return done(userTagJoinErr);
              }

              // Count +1
              userTagJoinRes.body.tag.count.should.be.equal(1);

              // User is now member of tribe
              userTagJoinRes.body.user.memberIds.length.should.be.equal(1);
              userTagJoinRes.body.user.member.length.should.be.equal(1);

              agent.post('/api/users/memberships')
                .send({
                  id: tribe._id,
                  relation: 'leave'
                })
                .expect(200)
                .end(function (userTagLeaveErr, userTagLeaveRes) {

                  // Handle leaving tag error
                  if (userTagLeaveErr) {
                    return done(userTagLeaveErr);
                  }

                  // Count -1
                  userTagLeaveRes.body.tag.count.should.be.equal(0);

                  // No more tags left on user's array
                  userTagLeaveRes.body.user.memberIds.length.should.be.equal(0);
                  userTagLeaveRes.body.user.member.length.should.be.equal(0);

                  return done();
                });

            });
        });
      });
  });

  it('should be able to show error if trying to join same tribe twice', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        var tribe = new Tag({
          label: 'Russian literature students',
          tribe: true
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          agent.post('/api/users/memberships')
            .send({
              id: tribe._id,
              relation: 'is'
            })
            .expect(200)
            .end(function (userTagJoinErr, userTagJoinRes) {

              // Handle joining tag error
              if (userTagJoinErr) {
                return done(userTagJoinErr);
              }

              // Count +1
              userTagJoinRes.body.tag.count.should.be.equal(1);

              // User is now member of tribe
              userTagJoinRes.body.user.memberIds.length.should.be.equal(1);
              userTagJoinRes.body.user.member.length.should.be.equal(1);

              agent.post('/api/users/memberships')
                .send({
                  id: tribe._id,
                  relation: 'is'
                })
                .expect(409)
                .end(function (userTagJoin2Err, userTagJoin2Res) {

                  // Handle leaving tag error
                  if (userTagJoin2Err) {
                    return done(userTagJoin2Err);
                  }

                  userTagJoin2Res.body.message.should.be.equal('Conflict.');

                  return done();
                });

            });
        });
      });
  });

  it('should be able to show error if trying to leave tribe user is not member of', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        var tribe = new Tag({
          label: 'Japanese linguistics',
          tribe: true
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          agent.post('/api/users/memberships')
            .send({
              id: tribe._id,
              relation: 'leave'
            })
            .expect(409)
            .end(function (userTagJoinErr, userTagJoinRes) {

              // Handle joining tag error
              if (userTagJoinErr) {
                return done(userTagJoinErr);
              }

              userTagJoinRes.body.message.should.be.equal('Conflict.');

              return done();
            });
        });
      });
  });

  it('should be able to show error if sending an action with odd "relation" info', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Create test tribe
        var tribe = new Tag({
          label: 'Space Squirrels',
          tribe: true
        });

        // Add tribe to test DB
        tribe.save(function (err, tribe) {
          should.not.exist(err);

          agent.post('/api/users/memberships')
            .send({
              id: tribe._id,
              relation: 'wtf'
            })
            .expect(400)
            .end(function (userTagJoinErr, userTagJoinRes) {

              // Handle joining tag error
              if (userTagJoinErr) {
                return done(userTagJoinErr);
              }

              userTagJoinRes.body.message.should.be.equal('Missing relation info.');

              return done();
            });
        });
      });
  });

  it('should be able to show error if trying to join non-existing tribe', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        agent.post('/api/users/memberships')
          .send({
            id: '572a3d36f905fe5c53bf1d1f',
            relation: 'is'
          })
          .expect(400)
          .end(function (userTagJoinErr, userTagJoinRes) {

            // Handle joining tag error
            if (userTagJoinErr) {
              return done(userTagJoinErr);
            }

            userTagJoinRes.body.message.should.be.equal('Bad request.');

            return done();
          });
      });
  });

  it('should be able to show error if trying to join with non standard ID', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        agent.post('/api/users/memberships')
          .send({
            id: '123456',
            relation: 'is'
          })
          .expect(400)
          .end(function (userTagJoinErr, userTagJoinRes) {

            // Handle joining tag error
            if (userTagJoinErr) {
              return done(userTagJoinErr);
            }

            userTagJoinRes.body.message.should.be.equal('Cannot interpret id.');

            return done();
          });
      });
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
    User.remove().exec(function () {
      Tag.remove().exec(done);
    });
  });
});

/**
 * Returns the NodeJS redirect text for any version.
 */
function redirectMessage(url) {
  // NodeJS v4 changed the status code representation so we must check
  // before asserting, to be comptabile with all node versions.
  if (semver.satisfies(process.versions.node, '>=4.0.0')) {
    return 'Found. Redirecting to ' + url;
  } else {
    return 'Moved Temporarily. Redirecting to ' + url;
  }
}

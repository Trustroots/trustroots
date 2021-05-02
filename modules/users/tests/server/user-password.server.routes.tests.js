const should = require('should');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
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

/**
 * User routes tests
 */
describe('User password CRUD tests', function () {
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

  it('forgot password should return 400 for non-existent username', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: 'some_username_that_doesnt_exist',
        })
        .expect(404)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.equal(
            'We could not find an account with that username or email. Make sure you have it spelled correctly.',
          );
          return done();
        });
    });
  });

  it('forgot password should return 400 for no username provided', function (done) {
    const provider = 'facebook';
    user.provider = provider;
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: '',
        })
        .expect(400)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.equal(
            'Please, we really need your username or email first...',
          );
          return done();
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using username', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.username,
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal(
            'We sent you an email with further instructions.',
          );

          User.findOne(
            { username: user.username.toLowerCase() },
            function (err, userRes) {
              userRes.resetPasswordToken.should.not.be.empty();
              should.exist(userRes.resetPasswordExpires);
              return done();
            },
          );
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using uppercase username', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.username.toUpperCase(),
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal(
            'We sent you an email with further instructions.',
          );

          User.findOne(
            { username: user.username.toLowerCase() },
            function (err, userRes) {
              userRes.resetPasswordToken.should.not.be.empty();
              should.exist(userRes.resetPasswordExpires);
              return done();
            },
          );
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using email', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.email,
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal(
            'We sent you an email with further instructions.',
          );

          User.findOne(
            { email: user.email.toLowerCase() },
            function (err, userRes) {
              userRes.resetPasswordToken.should.not.be.empty();
              should.exist(userRes.resetPasswordExpires);
              return done();
            },
          );
        });
    });
  });

  it('forgot password should be able to reset password for user password reset request using uppercase email', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.email.toUpperCase(),
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }

          res.body.message.should.be.equal(
            'We sent you an email with further instructions.',
          );

          User.findOne(
            { email: user.email.toLowerCase() },
            function (err, userRes) {
              userRes.resetPasswordToken.should.not.be.empty();
              should.exist(userRes.resetPasswordExpires);
              return done();
            },
          );
        });
    });
  });

  it('forgot password should be able to reset the password using reset token', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.username,
        })
        .expect(200)
        .end(function (err) {
          // Handle error
          if (err) {
            return done(err);
          }

          User.findOne(
            { username: user.username.toLowerCase() },
            function (err, userRes) {
              userRes.resetPasswordToken.should.not.be.empty();
              should.exist(userRes.resetPasswordExpires);
              agent
                .get('/api/auth/reset/' + userRes.resetPasswordToken)
                .expect(302)
                .end(function (err, res) {
                  // Handle error
                  if (err) {
                    return done(err);
                  }
                  res.headers.location.should.be.equal(
                    '/password/reset/' + userRes.resetPasswordToken,
                  );
                  return done();
                });
            },
          );
        });
    });
  });

  it('forgot password should return error when using invalid reset token', function (done) {
    user.roles = ['user'];

    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.username,
        })
        .expect(200)
        .end(function (err) {
          // Handle error
          if (err) {
            return done(err);
          }

          const invalidToken = 'someTOKEN1234567890';
          agent
            .get('/api/auth/reset/' + invalidToken)
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

  it('should be able to change password successfully', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent
          .post('/api/users/password')
          .send({
            newPassword: '1234567890Aa$',
            verifyPassword: '1234567890Aa$',
            currentPassword: credentials.password,
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

  it('should not be able to change password if wrong verifyPassword is given', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent
          .post('/api/users/password')
          .send({
            newPassword: '1234567890Aa$',
            verifyPassword: '1234567890-ABC-123-Aa$',
            currentPassword: credentials.password,
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

  it('should not be able to change password if wrong currentPassword is given', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent
          .post('/api/users/password')
          .send({
            newPassword: '1234567890Aa$',
            verifyPassword: '1234567890Aa$',
            currentPassword: 'some_wrong_passwordAa$',
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

  it('should not be able to change password if no new password is at all given', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Change password
        agent
          .post('/api/users/password')
          .send({
            newPassword: '',
            verifyPassword: '',
            currentPassword: credentials.password,
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

  it('should not be able to change password if no new password is at all given', function (done) {
    // Change password
    agent
      .post('/api/users/password')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
        currentPassword: credentials.password,
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
});

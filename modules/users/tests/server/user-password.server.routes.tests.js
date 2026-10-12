const should = require('should');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');
const testutils = require('../../../../testutils/server/server.testutil');
let jobs;

/**
 * Globals
 */
let app;
let agent;
let credentials;
let user;
let _user;

function findUserWithResetToken(query, callback) {
  const timeout = Date.now() + 3000;
  const check = () => {
    User.findOne(query, (err, foundUser) => {
      if (err) return callback(err);
      const mail = jobs.find(
        job =>
          job.data.to?.address === foundUser?.email &&
          job.data.text?.includes('/api/auth/reset/'),
      );
      if (foundUser?.resetPasswordToken && mail) {
        foundUser.resetPasswordToken.should.startWith('sha256:');
        const token = mail.data.text.match(
          /\/api\/auth\/reset\/([a-f0-9]+)/,
        )[1];
        foundUser.resetPasswordToken = token;
        return callback(null, foundUser);
      }
      if (Date.now() >= timeout) {
        return callback(new Error('Password recovery token was not saved.'));
      }
      return setTimeout(check, 10);
    });
  };

  check();
}

/**
 * User routes tests
 */
describe('User password CRUD tests', function () {
  jobs = testutils.catchJobs();
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
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

  it('rejects structured and oversized recovery identifiers', async function () {
    for (const username of [
      { $ne: null },
      ['sample-member'],
      12,
      'a'.repeat(321),
    ]) {
      await agent.post('/api/auth/forgot').send({ username }).expect(400);
    }
    const stored = await User.findById(user._id);
    should.not.exist(stored.resetPasswordToken);
  });

  it('forgot password acknowledges non-existent usernames consistently', function (done) {
    user.roles = ['user'];
    user.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/forgot')
        .send({
          username: 'some_username_that_doesnt_exist',
        })
        .expect(200)
        .end(function (err, res) {
          // Handle error
          if (err) {
            return done(err);
          }
          res.body.message.should.equal(
            'If an account matches that username or email, we will send recovery instructions.',
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
            'If an account matches that username or email, we will send recovery instructions.',
          );

          findUserWithResetToken(
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
            'If an account matches that username or email, we will send recovery instructions.',
          );

          findUserWithResetToken(
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
            'If an account matches that username or email, we will send recovery instructions.',
          );

          findUserWithResetToken(
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
            'If an account matches that username or email, we will send recovery instructions.',
          );

          findUserWithResetToken(
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

          findUserWithResetToken(
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
  it('forgot password should re-apply UTM parameters to the reset redirect', function (done) {
    user.roles = ['user'];
    user.save(function (saveErr) {
      should.not.exist(saveErr);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.username,
        })
        .expect(200)
        .end(function (forgotErr) {
          if (forgotErr) {
            return done(forgotErr);
          }

          findUserWithResetToken(
            { username: user.username.toLowerCase() },
            function (findErr, userRes) {
              should.not.exist(findErr);
              agent
                .get(
                  '/api/auth/reset/' +
                    userRes.resetPasswordToken +
                    '?utm_source=transactional_email&utm_medium=email&utm_campaign=reset',
                )
                .expect(302)
                .end(function (err, res) {
                  if (err) {
                    return done(err);
                  }
                  res.headers.location.should.containEql(
                    '/password/reset/' + userRes.resetPasswordToken,
                  );
                  res.headers.location.should.containEql(
                    'utm_source=transactional_email',
                  );
                  return done();
                });
            },
          );
        });
    });
  });
  it('should be able to reset the password with a valid token and matching passwords', function (done) {
    user.roles = ['user'];
    user.save(function (saveErr) {
      should.not.exist(saveErr);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.username,
        })
        .expect(200)
        .end(function (forgotErr) {
          if (forgotErr) {
            return done(forgotErr);
          }

          findUserWithResetToken(
            { username: user.username.toLowerCase() },
            function (findErr, userRes) {
              should.not.exist(findErr);
              agent
                .post('/api/auth/reset/' + userRes.resetPasswordToken)
                .send({
                  newPassword: '1234567890Aa$',
                  verifyPassword: '1234567890Aa$',
                })
                .expect(200)
                .end(function (err, res) {
                  if (err) {
                    return done(err);
                  }
                  res.body.username.should.equal(user.username.toLowerCase());

                  // The reset token should be cleared after a successful reset
                  User.findOne(
                    {
                      username: user.username.toLowerCase(),
                    },
                    function (err2, updated) {
                      should.not.exist(err2);
                      should.not.exist(updated.resetPasswordToken);
                      should.not.exist(updated.resetPasswordExpires);
                      return done();
                    },
                  );
                });
            },
          );
        });
    });
  });
  it('should not be able to reset the password if passwords do not match', function (done) {
    user.roles = ['user'];
    user.save(function (saveErr) {
      should.not.exist(saveErr);
      agent
        .post('/api/auth/forgot')
        .send({
          username: user.username,
        })
        .expect(200)
        .end(function (forgotErr) {
          if (forgotErr) {
            return done(forgotErr);
          }
          User.findOne(
            {
              username: user.username.toLowerCase(),
            },
            function (findErr, userRes) {
              should.not.exist(findErr);
              agent
                .post('/api/auth/reset/' + userRes.resetPasswordToken)
                .send({
                  newPassword: '1234567890Aa$',
                  verifyPassword: 'something-else-Aa$1',
                })
                .expect(400)
                .end(function (err, res) {
                  if (err) {
                    return done(err);
                  }
                  res.body.message.should.equal('Passwords do not match.');
                  return done();
                });
            },
          );
        });
    });
  });
  it('should not be able to reset the password with an invalid token', function (done) {
    agent
      .post('/api/auth/reset/someInvalidToken1234567890')
      .send({
        newPassword: '1234567890Aa$',
        verifyPassword: '1234567890Aa$',
      })
      .expect(400)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        res.body.message.should.equal(
          'Password reset token is invalid or has expired.',
        );
        return done();
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
            res.body.user.username.should.equal(user.username);
            res.body.user.email.should.equal(user.email);
            for (const field of [
              'password',
              'salt',
              'emailToken',
              'resetPasswordToken',
              'removeProfileToken',
              'providerData',
              'pushRegistration',
              'lastIpAddress',
            ]) {
              should.not.exist(res.body.user[field]);
            }
            return done();
          });
      });
  });

  it('requires the current password when changing credentials', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent
      .post('/api/users/password')
      .send({ newPassword: 'ExampleNew123!', verifyPassword: 'ExampleNew123!' })
      .expect(400);
    response.body.message.should.equal('Current password is incorrect.');
    await agent.post('/api/auth/signin').send(credentials).expect(200);
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

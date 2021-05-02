const should = require('should');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const dataUtils = require(path.resolve(
  './testutils/server/data.server.testutil',
));

const User = mongoose.model('User');

/**
 * Globals
 */
let app;
let agent;
let confirmedCredentials;
let confirmedUser;
let _confirmedUser;
let unConfirmedCredentials;
let unConfirmedUser;
let _unConfirmedUser;

/**
 * User routes tests
 */
describe('User signup and authentication CRUD tests', function () {
  const jobs = testutils.catchJobs();

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  // Create an user

  beforeEach(function (done) {
    // Create user credentials
    confirmedCredentials = {
      username: 'TR_username',
      password: 'TR-I$Aw3$0m4',
    };

    // Create a new user
    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@example.org',
      emailToken: 'initial email token',
      username: confirmedCredentials.username.toLowerCase(),
      password: confirmedCredentials.password,
      provider: 'local',
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    confirmedUser.save(done);
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
      acquisitionStory: 'A fish told me...',
    };

    unConfirmedUser = new User(_unConfirmedUser);

    // Save a user to the test db
    unConfirmedUser.save(done);
  });

  afterEach(dataUtils.clearDatabase);

  it('should be able to register a new user', function (done) {
    _unConfirmedUser.username = 'Register_New_User';
    _unConfirmedUser.email = 'register_new_user_@example.org';

    agent
      .post('/api/auth/signup')
      .send(_unConfirmedUser)
      .expect(200)
      .end(function (signupErr, signupRes) {
        // Handle signup error
        if (signupErr) {
          return done(signupErr);
        }
        signupRes.body.username.should.equal(
          _unConfirmedUser.username.toLowerCase(),
        );
        signupRes.body.username.should.not.equal(_unConfirmedUser.username);
        signupRes.body.email.should.equal(_unConfirmedUser.email);
        signupRes.body.emailTemporary.should.equal(_unConfirmedUser.email);
        signupRes.body.provider.should.equal('local');
        signupRes.body.public.should.equal(false);
        signupRes.body.created.should.not.be.empty();
        signupRes.body.acquisitionStory.should.equal(
          _unConfirmedUser.acquisitionStory,
        );
        should.not.exist(signupRes.body.updated);
        // Sensitive information should be not sent to the client
        should.not.exist(signupRes.body.emailToken);
        should.not.exist(signupRes.body.password);
        should.not.exist(signupRes.body.salt);
        should.not.exist(signupRes.body.roles);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal('Confirm Email');
        jobs[0].data.to.address.should.equal(_unConfirmedUser.email);

        done();
      });
  });

  it('should be able to register a new user but not inject additional roles', function (done) {
    _unConfirmedUser.username = 'Register_New_User';
    _unConfirmedUser.email = 'register_new_user_@example.org';
    _unConfirmedUser.roles = ['user', 'admin'];

    agent
      .post('/api/auth/signup')
      .send(_unConfirmedUser)
      .expect(200)
      .end(function (err, signupRes) {
        should.not.exist(err);
        should.not.exist(signupRes.body.roles);

        User.findById(signupRes.body._id, function (err, userFindRes) {
          should.not.exist(err);
          userFindRes.roles.should.be.instanceof(Array).and.have.lengthOf(1);
          userFindRes.roles.indexOf('user').should.equal(0);
          done();
        });
      });
  });

  it('should be able to register a new user and confirm email with token and user should become public', function (done) {
    _unConfirmedUser.username = 'Register_New_User';
    _unConfirmedUser.email = 'register_new_user_@example.org';

    agent
      .post('/api/auth/signup')
      .send(_unConfirmedUser)
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
        signupRes.body.emailTemporary.should.equal(_unConfirmedUser.email);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal('Confirm Email');
        jobs[0].data.to.address.should.equal(_unConfirmedUser.email);

        User.findOne(
          { username: _unConfirmedUser.username.toLowerCase() },
          function (err, userRes1) {
            if (err) {
              return done(err);
            }

            userRes1.public.should.equal(false);
            userRes1.email.should.not.be.empty();
            userRes1.emailToken.should.not.be.empty();

            // GET should give us redirect
            agent
              .get('/api/auth/confirm-email/' + userRes1.emailToken)
              .expect(302)
              .end(function (confirmEmailPostErr, confirmEmailGetRes) {
                if (confirmEmailPostErr) {
                  return done(confirmEmailPostErr);
                }

                confirmEmailGetRes.text.should.equal(
                  'Found. Redirecting to /confirm-email/' + userRes1.emailToken,
                );

                // POST does the actual job
                agent
                  .post('/api/auth/confirm-email/' + userRes1.emailToken)
                  .expect(200)
                  .end(function (confirmEmailPostErr, confirmEmailPostRes) {
                    if (confirmEmailPostErr) {
                      return done(confirmEmailPostErr);
                    }

                    jobs.length.should.equal(1);
                    jobs[0].type.should.equal('send email');

                    // User should now be public
                    confirmEmailPostRes.body.profileMadePublic.should.equal(
                      true,
                    );
                    confirmEmailPostRes.body.user.public.should.equal(true);
                    confirmEmailPostRes.body.user.emailTemporary.should.be.empty();

                    // Sensitive information should be not sent to the client
                    should.not.exist(confirmEmailPostRes.body.user.emailToken);
                    should.not.exist(confirmEmailPostRes.body.user.password);
                    should.not.exist(confirmEmailPostRes.body.user.salt);

                    return done();
                  });
              });
          },
        );
      });
  });

  it('should be able to register a new user and confirming email with wrong token should redirect error and yeld an error and user should not be public', function (done) {
    _unConfirmedUser.username = 'Register_New_User';
    _unConfirmedUser.email = 'register_new_user_@example.org';

    agent
      .post('/api/auth/signup')
      .send(_unConfirmedUser)
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
        signupRes.body.emailTemporary.should.equal(_unConfirmedUser.email);

        User.findOne(
          { username: _unConfirmedUser.username.toLowerCase() },
          function (err, userRes1) {
            if (err) {
              return done(err);
            }

            userRes1.public.should.equal(false);
            userRes1.email.should.not.be.empty();
            userRes1.emailToken.should.not.be.empty();

            // GET should give us redirect
            agent
              .get('/api/auth/confirm-email/WRONG_TOKEN')
              .expect(302)
              .end(function (confirmEmailPostErr, confirmEmailGetRes) {
                if (confirmEmailPostErr) {
                  return done(confirmEmailPostErr);
                }

                confirmEmailGetRes.text.should.equal(
                  'Found. Redirecting to /confirm-email-invalid',
                );

                // POST does the actual job
                agent
                  .post('/api/auth/confirm-email/WRONG_TOKEN')
                  .expect(400)
                  .end(function (confirmEmailPostErr, confirmEmailPostRes) {
                    if (confirmEmailPostErr) {
                      return done(confirmEmailPostErr);
                    }

                    confirmEmailPostRes.body.message.should.equal(
                      'Email confirm token is invalid or has expired.',
                    );

                    return done();
                  });
              });
          },
        );
      });
  });

  it('should be able to login successfully using username and logout successfully', function (done) {
    agent
      .post('/api/auth/signin')
      .send(confirmedCredentials)
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
        agent
          .get('/api/auth/signout')
          .expect(302)
          .end(function (signoutErr, signoutRes) {
            if (signoutErr) {
              return done(signoutErr);
            }

            signoutRes.redirect.should.equal(true);
            signoutRes.text.should.equal('Found. Redirecting to /');

            return done();
          });
      });
  });

  it('should be able to login successfully using email and logout successfully', function (done) {
    agent
      .post('/api/auth/signin')
      .send({
        username: 'test@example.org',
        password: confirmedCredentials.password,
      })
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Logout
        agent
          .get('/api/auth/signout')
          .expect(302)
          .end(function (signoutErr, signoutRes) {
            if (signoutErr) {
              return done(signoutErr);
            }

            signoutRes.redirect.should.equal(true);
            signoutRes.text.should.equal('Found. Redirecting to /');

            return done();
          });
      });
  });

  it('should not be able to login successfully if user has "suspended" role', function (done) {
    confirmedUser.roles = ['user', 'suspended'];

    confirmedUser.save(function (err) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(confirmedCredentials)
        .expect(403)
        .end(function (signinErr, signinRes) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          signinRes.body.message.should.equal(
            'Your account has been suspended.',
          );

          return done();
        });
    });
  });

  it('should invalidate sessions of authenticated user with "suspended" role and return error for json requests', function (done) {
    agent
      .post('/api/auth/signin')
      .send(confirmedCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Suspend user
        confirmedUser.roles = ['user', 'suspended'];
        confirmedUser.save(function (userSaveErr) {
          if (userSaveErr) {
            return done(userSaveErr);
          }

          // Load some json from API, get 403 suspended error
          agent
            .get('/api/users/' + confirmedUser.username)
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
              agent
                .get('/api/users/' + confirmedUser.username)
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
    agent
      .post('/api/auth/signin')
      .send(confirmedCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }

        // Suspend user
        confirmedUser.roles = ['user', 'suspended'];
        confirmedUser.save(function (userSaveErr) {
          if (userSaveErr) {
            return done(userSaveErr);
          }

          // Load html page
          agent
            .get('/')
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
              agent
                .get('/')
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
      agent
        .post('/api/auth/signin')
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
      agent
        .post('/api/auth/resend-confirmation')
        .expect(400)
        .end(function (err, resendRes) {
          if (err) return done(err);
          resendRes.body.message.should.equal('Already confirmed.');
          done();
        });
    });

    context('with changed email address', function () {
      beforeEach(function (done) {
        confirmedUser.emailTemporary = 'confirmed-test-changed@example.org';
        confirmedUser.save(done);
      });

      it('should resend confirmation token for email change', function (done) {
        agent
          .post('/api/auth/resend-confirmation')
          .expect(200)
          .end(function (err, resendRes) {
            if (err) return done(err);
            resendRes.body.message.should.equal('Sent confirmation email.');
            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal('Confirm email change');
            jobs[0].data.to.address.should.equal(
              'confirmed-test-changed@example.org',
            );
            done();
          });
      });
    });
  });

  context('logged in as un-confirmed user', function () {
    beforeEach(function (done) {
      agent
        .post('/api/auth/signin')
        .send(unConfirmedCredentials)
        .expect(200)
        .end(function (err, signinRes) {
          if (err) return done(err);
          // Sanity check they are unconfirmed
          signinRes.body.public.should.equal(false);
          done();
        });
    });

    it('should resend confirmation token', function (done) {
      agent
        .post('/api/auth/resend-confirmation')
        .expect(200)
        .end(function (err, resendRes) {
          if (err) return done(err);
          resendRes.body.message.should.equal('Sent confirmation email.');
          User.findOne(
            { username: _unConfirmedUser.username.toLowerCase() },
            'emailToken',
            function (err, userRes) {
              if (err) return done(err);
              should.exist(userRes);
              should.exist(userRes.emailToken);
              // Make sure it has changed from the original value
              userRes.emailToken.should.not.equal(_unConfirmedUser.emailToken);
              jobs.length.should.equal(1);
              jobs[0].type.should.equal('send email');
              jobs[0].data.subject.should.equal('Confirm Email');
              jobs[0].data.to.address.should.equal(
                _unConfirmedUser.emailTemporary,
              );
              done();
            },
          );
        });
    });
  });
});

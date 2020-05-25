const should = require('should');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
let app;
let agent;

/* users of the test */
let alice;
let bob;
let carol;

/**
 * User routes tests
 */
describe('User block - user', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Alice user
    const aliceCredentials = {
      username: 'alice_the_blocker',
      password: 'TR-I$Aw3$0m4',
    };

    const aliceProfile = {
      public: true,
      firstName: 'Alice',
      lastName: 'Doe',
      displayName: 'Alice Doe',
      email: 'alice@example.org',
      emailToken: 'initial email token',
      username: aliceCredentials.username.toLowerCase(),
      password: aliceCredentials.password,
      provider: 'local',
    };
    const aliceUser = new User(aliceProfile);
    alice = {
      credentials: aliceCredentials,
      user: aliceUser,
      profile: aliceProfile,
    };

    // Bob user
    const bobCredentials = {
      username: 'bob_the_blocked',
      password: 'TR-I$Aw3$0m4',
    };
    const bobProfile = {
      public: true,
      firstName: 'Bob',
      lastName: 'Doe',
      displayName: 'bob doe',
      email: 'bob@example.org',
      emailToken: 'initial email token',
      username: bobCredentials.username.toLowerCase(),
      password: bobCredentials.password,
      provider: 'local',
    };
    const bobUser = new User(bobProfile);
    bob = { credentials: bobCredentials, user: bobUser, profile: bobProfile };

    // Carol user
    const carolCredentials = {
      username: 'carol_the_blocker',
      password: 'TR-I$Aw3$0m4',
    };
    const carolProfile = {
      public: true,
      firstName: 'Carol',
      lastName: 'Doe',
      displayName: 'Carol Doe',
      email: 'carol@example.org',
      emailToken: 'initial email token',
      username: carolCredentials.username.toLowerCase(),
      password: carolCredentials.password,
      provider: 'local',
    };
    const carolUser = new User(carolProfile);
    carol = {
      credentials: carolCredentials,
      user: carolUser,
      profile: carolProfile,
    };

    // Save alice and bob to test db
    Promise.all([aliceUser.save(), bobUser.save(), carolUser.save()])
      .then(() => done())
      .catch(done);
  });

  it('should be able to see a user if not blocked by her', function (done) {
    /* bob login */
    agent
      .post('/api/auth/signin')
      .send(bob.credentials)
      .expect(200)
      .end(function (err) {
        // Handle signin error
        if (err) {
          return done(err);
        }
        /* bob can see alice */
        agent
          .get('/api/users/' + alice.credentials.username)
          .expect(200)
          .end(function (err, resp) {
            if (err) {
              return done(err);
            }
            const response = resp.body;
            should(response).have.property('displayName');
            should(response.displayName).be.equal('Alice Doe');
            return done();
          });
      });
  });

  it('should not see a user if users blocked by her', function (done) {
    /* alice login */
    agent
      .post('/api/auth/signin')
      .send(alice.credentials)
      .expect(200)
      .end(function (err) {
        // Handle signin error
        if (err) {
          return done(err);
        }
        /* alice blocks bob */
        agent
          .put('/api/users/blocked-users/' + bob.credentials.username)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            /* bob login */
            agent
              .post('/api/auth/signin')
              .send(bob.credentials)
              .expect(200)
              .end(function (err) {
                if (err) {
                  return done(err);
                }
                /* bob cant see alice */
                agent
                  .get('/api/users/' + alice.credentials.username)
                  .expect(404) // not found!
                  .end(function (err) {
                    if (err) {
                      return done(err);
                    }
                    return done();
                  });
              });
          });
      });
  });

  it('should get the list of his blocked peers', function (done) {
    /* alice login */
    agent
      .post('/api/auth/signin')
      .send(alice.credentials)
      .expect(200)
      .end(function (err) {
        // Handle signin error
        if (err) {
          return done(err);
        }
        /* alice blocks bob */
        agent
          .put('/api/users/blocked-users/' + bob.credentials.username)
          .expect(200)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            /* alice see bob in blocked list */
            agent
              .get('/api/users/blocked-users')
              .expect(200) // not found!
              .end(function (err, resp) {
                if (err) {
                  return done(err);
                }
                const blocked = resp.body;
                should(bob.credentials.username).be.in(blocked);
                return done();
              });
          });
      });
  });
  afterEach(function (done) {
    User.deleteMany().exec(done);
  });

  it('should see a user if unblocked by her', function (done) {
    /* alice login */
    agent
      .post('/api/auth/signin')
      .send(alice.credentials)
      .expect(200)
      .end(function (err) {
        // Handle signin error
        if (err) {
          return done(err);
        }
        /* alice cant see carol */
        agent
          .get('/api/users/' + carol.credentials.username)
          .expect(404)
          .end(function (err) {
            if (err) {
              return done(err);
            }
            /* carol login */
            agent
              .post('/api/auth/signin')
              .send(carol.credentials)
              .expect(200)
              .end(function (err) {
                if (err) {
                  return done(err);
                }
                /* carol unblock alice */
                agent
                  .post(
                    '/api/users/blocked-users/' + alice.credentials.username,
                  )
                  .send(alice.credentials)
                  .expect(200)
                  .end(function (err) {
                    if (err) {
                      return done(err);
                    }
                    /* alice login */
                    agent
                      .post('/api/auth/signin')
                      .send(alice.credentials)
                      .expect(200)
                      .end(function (err) {
                        // Handle signin error
                        if (err) {
                          return done(err);
                        }
                        /* alice can see carol now! */
                        agent
                          .get('/api/users/' + carol.credentials.username)
                          .expect(200)
                          .end(function (err, res) {
                            if (err) {
                              return done(err);
                            }
                            const response = res.body;
                            should(response.displayName).be.equal('Alice Doe');
                            done();
                          });
                      });
                  });
              });
          });
      });
  });
});

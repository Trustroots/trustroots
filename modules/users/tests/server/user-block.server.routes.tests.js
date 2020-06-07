const should = require('should');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const express = require(path.resolve('./config/lib/express'));
const log = require(path.resolve('./config/lib/logger'));

/**
 * Globals
 */
let app;
let agent;

/* users of the test */
let alice;
let bob;
let carol;

function checkError(message, done) {
  return err => {
    log('error', `Error while >> ${message}`);
    done(err);
    throw err;
  };
}

const login = credentials =>
  new Promise((resolve, reject) =>
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end((err, resp) => {
        if (err) {
          reject(err);
        }
        log('info', `${credentials.username} login`);
        resolve(resp);
      }),
  );

const block = username =>
  new Promise((resolve, reject) =>
    agent
      .put(`/api/blocked-users/${username}`)
      .expect(200)
      .end((err, resp) => {
        if (err) {
          reject(err);
        }
        log('info', `blocked ${username}`);
        resolve(resp);
      }),
  );
const getUser = username =>
  new Promise((resolve, reject) =>
    agent
      .get(`/api/users/${username}`)
      .expect(200)
      .end((err, resp) => {
        if (err) {
          reject(err);
        }
        log('info', `got ${username}`);
        resolve(resp);
      }),
  );
/**
 * User routes tests
 */
describe.only('User block - user', function () {
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

  afterEach(function (done) {
    User.deleteMany().exec(done);
  });

  it('should be able to see a user if not blocked by her', function (done) {
    /* bob login */
    login(bob.credentials)
      .catch(checkError('bob sees alice: bob login', done))
      .then(() => getUser(alice.credentials.username) /* bob can see alice */)
      .catch(checkError('bob sees alice: get', done))
      .then(resp => {
        const response = resp.body;
        log('info', `bob sees ${response.displayName}`);
        should(response).have.property('displayName');
        should(response.displayName).equal('Alice Doe');
        return done();
      });
  });

  it('should get the list of the usernames of her blocked peers', function (done) {
    /* alice login */
    login(alice.credentials)
      .catch(checkError('alice list blocked users: login', done))
      .then(() => block(bob.credentials.username))
      .catch(checkError('alice list blocked users: block bob', done))
      .then((resp) => {
        /* alice see bob in blocked list */
        log('info', `block response ${JSON.stringify(resp.body)}`);
        agent
          .get('/api/blocked-users')
          .expect(200) // not found!
          .end(function (err, resp) {
            if (err) {
              return done(err);
            }
            const blocked = resp.body;
            const bobUsername = { username: bob.credentials.username };
            log('info', `alice blocked: ${JSON.stringify(bobUsername)}`);
            should(blocked).matchAny(bobUsername);
            return done();
          });
      });
  });

  it('should not see a user if blocked by her', function (done) {
    /* alice blocks bob */
    login(alice.credentials)
      .catch(checkError('alice login', done))
      .then(() => block(bob.credentials.username))
      .catch(checkError('alice blocks bob', done))
      .then(() => login(bob.credentials))
      .catch(checkError('bob login', done))
      .then(() => {
        const url = `/api/users/${alice.credentials.username}`;
        log('info', url);
        agent
          .get(url)
          .expect(404) // not found!
          .end(function (err) {
            if (err) {
              log('error', err);
              done(err);
              throw err;
            }
            log('info', "bob can't see alice");
            done();
          });
      });
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

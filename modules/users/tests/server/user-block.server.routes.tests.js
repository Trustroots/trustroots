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

function checkError(message, done) {
  return err => {
    log('error', `Error while >> ${message}`);
    log('error', err);
    done(err);
  };
}

const login = credentials =>
  new Promise((resolve, reject) => {
    agent = request.agent(app);
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end((err, resp) => {
        if (err) {
          log('error', `${credentials.username} login`);
          log('error', err);
          reject(err);
        }
        log('info', `${credentials.username} login`);
        resolve(resp);
      });
  });

/**
 * Requests reused during tests
 */
const block = username =>
  new Promise((resolve, reject) =>
    agent
      .put(`/api/blocked-users/${username}`)
      .expect(200)
      .end((err, resp) => {
        if (err) {
          log('error', `blocking ${username}`);
          log('error', err);
          reject(err);
        }
        log('info', `blocked ${username}`);
        resolve(resp);
      }),
  );
const unblock = username =>
  new Promise((resolve, reject) =>
    agent
      .delete(`/api/blocked-users/${username}`)
      .expect(200)
      .end((err, resp) => {
        if (err) {
          log('error', `unblocking ${username}`);
          log('error', err);
          reject(err);
        }
        log('info', `unblocked ${username}`);
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
          log('error', `get ${username}`);
          log('error', err);
          reject(err);
        }
        log('info', `got ${username}`);
        resolve(resp);
      }),
  );

const searchUser = (searchStr, expectedStatus = 200) =>
  new Promise((resolve, reject) =>
    agent
      .get(`/api/users/?search=${searchStr}`)
      .expect(expectedStatus)
      .end((err, resp) => {
        if (err) {
          log('error', `search ${searchStr}`);
          log('error', err);
          reject(err);
        }
        log('info', `searched for ${searchStr}`);
        resolve(resp.body);
      }),
  );

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

    // Save alice and bob to test db
    Promise.all([aliceUser.save(), bobUser.save()])
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
      .then(resp => {
        /* alice see bob in blocked list */
        log('info', `block response ${JSON.stringify(resp.body)}`);
        agent
          .get('/api/blocked-users')
          .expect(200)
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
              return;
            }
            log('info', "bob can't see alice");
            done();
          });
      })
      .catch(checkError('uncatched error - improve the test', done));
  });

  it('should not appear in search if has been blocked the searcher', function (done) {
    const aliceUsername = { username: alice.credentials.username };
    login(bob.credentials)
      .catch(checkError('bob login', done))
      .then(() => searchUser('Alice'))
      .then(resultUsers => {
        /** not blocked yet. should appear in search */
        should(resultUsers).matchAny(aliceUsername);
      })
      .then(() => login(alice.credentials))
      .catch(checkError('alice login', done))
      .then(() => block(bob.credentials.username))
      .catch(checkError('alice blocks bob', done))
      .then(() => login(bob.credentials))
      .catch(checkError('bob login', done))
      .then(() => searchUser('Alice'))
      .catch(checkError('bob search Alice', done))
      .then(resultUsers => {
        /** blocked. should not appear in search */
        should(resultUsers).not.matchAny(aliceUsername);
        done();
      })
      .catch(checkError('uncatched error', done));
  });

  it('should not see a user if blocked her', function (done) {
    const bobUsername = { username: bob.credentials.username };
    login(alice.credentials)
      .catch(checkError('alice login', done))
      .then(() => searchUser('Bob'))
      .then(resultUsers => {
        should(resultUsers).matchAny(bobUsername);
      })
      .catch(checkError('alice can see bob', done))
      .then(() => block(bob.credentials.username))
      .catch(checkError('alice blocks bob', done))
      .then(() => searchUser('Bob'))
      .catch(checkError('search bob', done))
      .then(resultUsers => {
        should(resultUsers).not.matchAny(bobUsername);
        done();
      })
      .catch(checkError('uncatched error - improve the test', done));
  });

  it('should see a user if unblocked by her', function (done) {
    login(alice.credentials)
      .catch(checkError('alice login', done))
      .then(() => block(bob.credentials.username))
      .catch(checkError('alice blocks bob', done))
      .then(() => login(bob.credentials))
      .catch(checkError('bob login', done))
      .then(() => {
        const url = `/api/users/${alice.credentials.username}`;
        log('info', 'bob tryies to get alice profile');
        return agent
          .get(url)
          .expect(404) // not found!
          .then(function () {
            log('info', "bob can't see alice");
          })
          .catch(err => {
            log('error', err);
            done(err);
          });
      })
      .then(() => login(alice.credentials))
      .catch(checkError('alice login', done))
      .then(() => unblock(bob.credentials.username))
      .catch(checkError('alice unblocks bob', done))
      .then(() => login(bob.credentials))
      .catch(checkError('bob login', done))
      .then(() => {
        const url = `/api/users/${alice.credentials.username}`;
        log('info', 'bob tryies to get alice profile');
        return agent
          .get(url)
          .expect(200) // found now!
          .then(function () {
            log('info', 'bob sees alice now');
            done();
          })
          .catch(checkError('geting alice profile', done));
      })
      .catch(checkError('uncatched error - improve the test', done));
  });
});

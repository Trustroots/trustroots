const should: typeof import('should') = require('should');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const moment: typeof import('moment') = require('moment');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type UserModel =
  import('../../../../testutils/server/model-contracts.mts').UserModel;
type UserDocument =
  import('../../../../testutils/server/model-contracts.mts').UserModelDocument;
type ProfileUserDocument = UserDocument & {
  usernameUpdateAllowed?: boolean;
};
type Credentials =
  import('../../../../testutils/server/model-contracts.mts').Credentials;
const User = mongoose.model<UserRecord, UserModel>('User');
const validNpub =
  'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
const nsec = 'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwkhnav';
/**
 * Globals
 */
let app: import('../../../../testutils/server/model-contracts.mts').TestExpressApp;
let agent: import('supertest').Agent;
let credentials: Credentials;
let user: UserDocument;
let _user: UserRecord;
let user2: UserDocument;
let _user2: UserRecord;
let unConfirmedCredentials: Credentials;
let unConfirmedUser: UserDocument;
let _unConfirmedUser: UserRecord;
type ProfileUpdatePayload = Omit<UserRecord, 'email'> & {
  email?: string;
};
type CookieHeader = string | string[] | undefined;
function responseCookies(header: CookieHeader): string[] {
  if (Array.isArray(header)) return header;
  return header ? [header] : [];
}
/**
 * User routes tests
 */
describe('User profile CRUD tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  // Create a confirmed user
  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'TRusername',
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
    user
      .save()
      .then(() => done())
      .catch(done);
  });
  // Create another confirmed user
  beforeEach(function (done) {
    _user2 = {
      public: true,
      firstName: 'Full2',
      lastName: 'Name2',
      displayName: 'Full2 Name2',
      email: 'test2@example.org',
      username: 'trusername2',
      password: 'TR-I$Aw3$0m3',
      provider: 'local',
      roles: ['user'],
    };
    user2 = new User(_user2);
    user2
      .save()
      .then(() => done())
      .catch(done);
  });
  // Create an unconfirmed user
  beforeEach(function (done) {
    unConfirmedCredentials = {
      username: 'TRusernameunconfirmed',
      password: 'TR-I$Aw3$0m4',
    };
    _unConfirmedUser = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'unconfirmed-test@example.org',
      emailTemporary: 'unconfirmed-test@example.org',
      // unconfirmed users have this set
      emailToken: 'initial email token',
      username: unConfirmedCredentials.username.toLowerCase(),
      password: unConfirmedCredentials.password,
      provider: 'local',
      roles: ['user'],
    };
    unConfirmedUser = new User(_unConfirmedUser);
    // Save a user to the test db
    unConfirmedUser
      .save()
      .then(() => done())
      .catch(done);
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
            res.body.avatarSource.should.equal('none'); // Defaults to `none`
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
    user
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
  });
  it('should be able to get other user details successfully when with role "shadowban"', function (done) {
    user.roles = ['user', 'shadowban'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
  });
  it('should not be able to get other users details successfully that have "shadowban" role', function (done) {
    user2.roles = ['user', 'shadowban'];
    user2
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
  });
  it('should not be able to get other users details successfully that have "shadowban" role when with legacy role "moderator"', function (done) {
    user.roles = ['user', 'moderator'];
    user2.roles = ['user', 'shadowban'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        user2
          .save()
          .then(() => {
            should.not.exist(null);
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
          })
          .catch(done);
      })
      .catch(done);
  });
  it('should be able to get other users details successfully that have "shadowban" role when with role "admin"', function (done) {
    user.roles = ['user', 'admin'];
    user2.roles = ['user', 'shadowban'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        user2
          .save()
          .then(() => {
            should.not.exist(null);
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
          })
          .catch(done);
      })
      .catch(done);
  });
  it('should be able to see that someone is volunteer when they have "volunteer" role', function (done) {
    user2.roles = ['user', 'volunteer'];
    user2
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
  });
  it('should be able to see that someone is volunteer-alumni when they have "volunteer-alumni" role', function (done) {
    user2.roles = ['user', 'volunteer-alumni'];
    user2
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
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
    user
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
  });
  it('preserves an omitted surname and allows clearing it', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const unchanged = await agent
      .put('/api/users')
      .send({ tagline: 'A short note' })
      .expect(200);
    unchanged.body.lastName.should.equal('Name');
    const cleared = await agent
      .put('/api/users')
      .send({ lastName: '' })
      .expect(200);
    cleared.body.lastName.should.equal('');
    cleared.body.displayName.should.equal('Full');
    const malformed = await agent
      .put('/api/users')
      .send({ lastName: { value: 'Nope' } })
      .expect(400);
    malformed.body.message.should.equal('Please enter a valid last name.');
  });
  it('persists language levels and preserves them for older clients', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const saved = await agent
      .put('/api/users')
      .send({
        languages: ['eng', 'fre'],
        languageLevels: { eng: 'native', fre: 'basic' },
      })
      .expect(200);
    saved.body.languageLevels.should.deepEqual({ eng: 'native', fre: 'basic' });
    const profile = await agent.get('/api/users/' + user.username).expect(200);
    profile.body.languageLevels.should.deepEqual(saved.body.languageLevels);
    const unchanged = await agent
      .put('/api/users')
      .send({ tagline: 'A fictional traveller' })
      .expect(200);
    unchanged.body.languageLevels.should.deepEqual(saved.body.languageLevels);
    const removed = await agent
      .put('/api/users')
      .send({ languages: ['eng'] })
      .expect(200);
    removed.body.languageLevels.should.deepEqual({ eng: 'native' });
    const cleared = await agent
      .put('/api/users')
      .send({ languageLevels: {} })
      .expect(200);
    (cleared.body.languageLevels || {}).should.deepEqual({});
    await agent.put('/api/users').send({ languages: [] }).expect(200);
  });
  it('rejects malformed and unselected language levels', async function () {
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    await agent
      .put('/api/users')
      .send({ languages: ['eng'], languageLevels: { eng: 'intermediate' } })
      .expect(200);
    for (const languageLevels of [
      null,
      [],
      'native',
      42,
      { eng: 1 },
      { eng: 'fluent' },
      { fre: 'basic' },
    ]) {
      await agent.put('/api/users').send({ languageLevels }).expect(400);
    }
    await agent
      .put('/api/users')
      .send({ languages: [], languageLevels: { eng: 'advanced' } })
      .expect(400);
    await agent
      .put('/api/users')
      .send({ languages: 'eng', languageLevels: {} })
      .expect(400);
    const unchanged = await agent
      .get('/api/users/' + user.username)
      .expect(200);
    unchanged.body.languageLevels.should.deepEqual({ eng: 'intermediate' });
  });
  it('retains and removes existing deprecated languages but rejects new ones', async function () {
    user.languages = ['enm'];
    await user.save();
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const retained = await agent
      .put('/api/users')
      .send({
        languages: ['enm', 'eng'],
      })
      .expect(200);
    retained.body.languages.should.deepEqual(['enm', 'eng']);
    const removed = await agent
      .put('/api/users')
      .send({
        languages: ['eng'],
      })
      .expect(200);
    removed.body.languages.should.deepEqual(['eng']);
    const rejected = await agent
      .put('/api/users')
      .send({
        languages: ['eng', 'enm'],
      })
      .expect(400);
    rejected.body.message.should.equal(
      'This language can no longer be added to profiles.',
    );
    await agent
      .put('/api/users')
      .send({
        languages: ['iso_639_3-lfn'],
      })
      .expect(400);
    await agent
      .put('/api/users')
      .send({
        languages: 'enm',
      })
      .expect(400);
    const stored = await User.findById(user._id);
    Array.from(stored!.languages!).should.deepEqual(['eng']);
  });
  it('should be able to update own nostr npub', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr, signinRes) {
            if (signinErr) {
              return done(signinErr);
            }
            const signinSessionCookie = responseCookies(
              signinRes.headers['set-cookie'],
            ).find(cookie => cookie.startsWith('connect.sid='));
            agent
              .put('/api/users')
              .send({
                nostrNpub: validNpub,
              })
              .expect(200)
              .end(function (userInfoErr, userInfoRes) {
                if (userInfoErr) {
                  return done(userInfoErr);
                }
                userInfoRes.body.nostrNpub.should.equal(validNpub);
                const updateSessionCookie = responseCookies(
                  userInfoRes.headers['set-cookie'],
                ).find(cookie => cookie.startsWith('connect.sid='));
                if (updateSessionCookie) {
                  updateSessionCookie
                    .split(';')[0]
                    .should.equal(signinSessionCookie!.split(';')[0]);
                }
                User.findById(user._id)
                  .then((userFindRes: UserDocument | null) => {
                    should.not.exist(null);
                    userFindRes!.nostrNpub!.should.equal(validNpub);
                    return done();
                  })
                  .catch(done);
              });
          });
      })
      .catch(done);
  });
  it('should trim and canonicalize nostr npub when updating own profile', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            if (signinErr) {
              return done(signinErr);
            }
            agent
              .put('/api/users')
              .send({
                nostrNpub: '  ' + validNpub.toUpperCase() + '  ',
              })
              .expect(200)
              .end(function (userInfoErr, userInfoRes) {
                if (userInfoErr) {
                  return done(userInfoErr);
                }
                userInfoRes.body.nostrNpub.should.equal(validNpub);
                User.findById(user._id)
                  .then((userFindRes: UserDocument | null) => {
                    should.not.exist(null);
                    userFindRes!.nostrNpub!.should.equal(validNpub);
                    return done();
                  })
                  .catch(done);
              });
          });
      })
      .catch(done);
  });
  it('should allow saving own existing nostr npub', function (done) {
    user.roles = ['user'];
    user.nostrNpub = validNpub;
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            if (signinErr) {
              return done(signinErr);
            }
            agent
              .put('/api/users')
              .send({
                nostrNpub: validNpub,
              })
              .expect(200)
              .end(function (userInfoErr, userInfoRes) {
                if (userInfoErr) {
                  return done(userInfoErr);
                }
                userInfoRes.body.nostrNpub.should.equal(validNpub);
                return done();
              });
          });
      })
      .catch(done);
  });
  it('should reject nostr npub claimed by another user', function (done) {
    user.roles = ['user'];
    user2.nostrNpub = validNpub;
    user2
      .save()
      .then(() => {
        should.not.exist(null);
        user
          .save()
          .then(() => {
            should.not.exist(null);
            agent
              .post('/api/auth/signin')
              .send(credentials)
              .expect(200)
              .end(function (signinErr) {
                if (signinErr) {
                  return done(signinErr);
                }
                agent
                  .put('/api/users')
                  .send({
                    nostrNpub: validNpub,
                  })
                  .expect(403)
                  .end(function (userInfoErr, userInfoRes) {
                    if (userInfoErr) {
                      return done(userInfoErr);
                    }
                    userInfoRes.body.message.should.equal(
                      'This nostr npub is already in use. Please use another one.',
                    );
                    return done();
                  });
              });
          })
          .catch(done);
      })
      .catch(done);
  });
  it('should be able to clear nostr npub when updating own profile', function (done) {
    user.roles = ['user'];
    user.nostrNpub = validNpub;
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            if (signinErr) {
              return done(signinErr);
            }
            agent
              .put('/api/users')
              .send({
                nostrNpub: '',
              })
              .expect(200)
              .end(function (userInfoErr, userInfoRes) {
                if (userInfoErr) {
                  return done(userInfoErr);
                }
                userInfoRes.body.nostrNpub.should.equal('');
                User.findById(user._id)
                  .then((userFindRes: UserDocument | null) => {
                    should.not.exist(null);
                    userFindRes!.nostrNpub!.should.equal('');
                    return done();
                  })
                  .catch(done);
              });
          });
      })
      .catch(done);
  });
  it('should reject malformed nostr npub when updating own profile', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            if (signinErr) {
              return done(signinErr);
            }
            agent
              .put('/api/users')
              .send({
                nostrNpub: 'npub1invalid',
              })
              .expect(400)
              .end(function (userInfoErr, userInfoRes) {
                if (userInfoErr) {
                  return done(userInfoErr);
                }
                userInfoRes.body.message.should.equal(
                  'Invalid nostr key. Please provide your npub (public key) starting with "npub". Never use your nsec (secret key).',
                );
                return done();
              });
          });
      })
      .catch(done);
  });
  it('should reject nostr secret keys when updating own profile', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            if (signinErr) {
              return done(signinErr);
            }
            agent
              .put('/api/users')
              .send({
                nostrNpub: nsec,
              })
              .expect(400)
              .end(function (userInfoErr, userInfoRes) {
                if (userInfoErr) {
                  return done(userInfoErr);
                }
                userInfoRes.body.message.should.equal(
                  'Invalid nostr key. Please provide your npub (public key) starting with "npub". Never use your nsec (secret key).',
                );
                return done();
              });
          });
      })
      .catch(done);
  });
  it('should reject a non-string nostr npub when updating own profile', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            if (signinErr) {
              return done(signinErr);
            }
            agent
              .put('/api/users')
              .send({
                nostrNpub: 12345,
              })
              .expect(400)
              .end(function (userInfoErr, userInfoRes) {
                if (userInfoErr) {
                  return done(userInfoErr);
                }
                userInfoRes.body.message.should.equal(
                  'Invalid nostr key. Please provide your npub (public key) starting with "npub". Never use your nsec (secret key).',
                );
                return done();
              });
          });
      })
      .catch(done);
  });
  it('should not be able to add roles to own profile', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
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
                User.findById(user._id)
                  .then((userFindRes: UserDocument | null) => {
                    should.not.exist(userInfoErr);
                    userFindRes!.firstName.should.be.equal('user_update_first');
                    userFindRes!.lastName.should.be.equal('user_update_last');
                    userFindRes!._id
                      .toString()
                      .should.be.equal(user._id.toString());
                    userFindRes!
                      .roles!.should.be.instanceof(Array)
                      .and.have.lengthOf(1);
                    userFindRes!.roles!.indexOf('user').should.equal(0);
                    return done();
                  })
                  .catch(done);
              });
          });
      })
      .catch(done);
  });
  it('should not be able to set the server-owned avatar version', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            if (signinErr) {
              return done(signinErr);
            }
            agent
              .put('/api/users')
              .send({
                avatarVersion: '../another-member',
              })
              .expect(200)
              .end(function (userInfoErr) {
                should.not.exist(userInfoErr);
                User.findById(user._id)
                  .then((savedUser: UserDocument | null) => {
                    should.not.exist(null);
                    (savedUser!.avatarVersion === undefined).should.be.true();
                    done();
                  })
                  .catch(done);
              });
          });
      })
      .catch(done);
  });
  it('should not be able to update profile details with existing email', function (done) {
    const _user2 = _user;
    _user2.username = 'user2username';
    _user2.email = 'user2_email@example.org';
    _user2.emailTemporary = 'user2_email@example.org';
    const credentials2 = {
      username: 'username2',
      password: 'TR-I$Aw3$0m4',
    };
    _user2.username = credentials2.username;
    _user2.password = credentials2.password;
    const user2 = new User(_user2);
    user2
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
  });
  it('should not be able to update profile if not logged-in', function (done) {
    user.roles = ['user'];
    user
      .save()
      .then(() => {
        should.not.exist(null);
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
      })
      .catch(done);
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
            .set('X-Trustroots-Request', '1')
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
        .end(function (err: Error | null) {
          if (err) {
            return done(err);
          }
          const user2: ProfileUpdatePayload = _user;
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
      user!
        .updateOne({
          $set: {
            created: threeMonthsAgo,
          },
        })
        .then(() => {
          should.not.exist(null);
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (err: Error | null) {
              if (err) {
                return done(err);
              }
              const user2: ProfileUpdatePayload = _user;
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
        })
        .catch(done);
    });
    it('should not be able to change username if username was changed within previous 3 months', function (done) {
      const threeMonthsAgo = moment(user.created)
        .subtract(3, 'months')
        .toDate();
      user!
        .updateOne({
          $set: {
            created: threeMonthsAgo,
          },
        })
        .then(() => {
          should.not.exist(null);
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (err: Error | null) {
              if (err) {
                return done(err);
              }
              const user2: ProfileUpdatePayload = _user;
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
        })
        .catch(done);
    });
    it('should be able to change username if username was changed more than 3 months ago', function (done) {
      const threeMonthsAgo = moment(user.created)
        .subtract(3, 'months')
        .toDate();
      user!
        .updateOne({
          $set: {
            created: threeMonthsAgo,
          },
        })
        .then(() => {
          should.not.exist(null);
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (err: Error | null) {
              if (err) {
                return done(err);
              }
              // First change
              const user2: ProfileUpdatePayload = _user;
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
                  User.findById(user._id)
                    .then((user: UserDocument | null) => {
                      const threeMonthsAgo = moment(user!.usernameUpdated)
                        .subtract(3, 'months')
                        .toDate();
                      user!
                        .updateOne({
                          $set: {
                            usernameUpdated: threeMonthsAgo,
                          },
                        })
                        .then(() => {
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
                        })
                        .catch(done);
                    })
                    .catch(done);
                });
            });
        })
        .catch(done);
    });
    it('should not be allowed to change the usernameUpdateAllowed status', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err: Error | null) {
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
              User.findOne({
                username: credentials.username,
              })
                .then((newUser: ProfileUserDocument | null) => {
                  should.not.exist(newUser!.usernameUpdateAllowed);
                  done(null);
                })
                .catch(done);
            });
        });
    });
    it('should not be allowed to change the date when their username was last changed', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (err: Error | null) {
          if (err) {
            return done(err);
          }
          agent
            .put('/api/users')
            .send({
              usernameUpdated: moment().subtract(3, 'months').toDate(),
            })
            .expect(200)
            .end(function (err: Error | null) {
              if (err) {
                return done(err);
              }
              User.findOne({
                username: credentials.username,
              })
                .then((newUser: UserDocument | null) => {
                  should.not.exist(newUser!.usernameUpdated);
                  done(null);
                })
                .catch(done);
            });
        });
    });
  });
});

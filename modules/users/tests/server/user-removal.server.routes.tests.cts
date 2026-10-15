const fs: typeof import('fs') = require('fs');
const actionTokenService: typeof import('../../server/services/action-token.server.service.mjs') = require('../../server/services/action-token.server.service.mjs');
const { hashToken } = actionTokenService;
interface AsyncTestApi {
  each<T>(
    items: T[],
    iteratee: (item: T, callback: (error?: Error | null) => void) => void,
    callback: (error?: Error | null) => void,
  ): void;
  waterfall(
    tasks: Array<(...args: never[]) => void>,
    callback: (error?: Error | null, result?: unknown) => void,
  ): void;
}
type StepCallback = (error?: unknown, result?: unknown) => void;
type DoneCallback = (error?: unknown) => void;
const async = require('async') as AsyncTestApi;
const should: typeof import('should') = require('should');
const sinon: typeof import('sinon') = require('sinon');
const request: typeof import('supertest') = require('supertest');
const path: typeof import('path') = require('path');
const mongoose: typeof import('mongoose') = require('mongoose');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('./../../../../config/lib/express.mjs');
const testutils: typeof import('../../../../testutils/server/server.testutil.mts') = require('../../../../testutils/server/server.testutil');
const dataUtils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type UserModel =
  import('../../../../testutils/server/model-contracts.mts').UserModel;
type UserModelDocument =
  import('../../../../testutils/server/model-contracts.mts').UserModelDocument;
type Credentials =
  import('../../../../testutils/server/model-contracts.mts').Credentials;
type TestExpressApp =
  import('../../../../testutils/server/model-contracts.mts').TestExpressApp;
type TestAgent =
  import('../../../../testutils/server/model-contracts.mts').TestAgent;
type ContactRecord =
  import('../../../../testutils/server/model-contracts.mts').ContactRecord;
type ContactModel =
  import('../../../../testutils/server/model-contracts.mts').ContactModel;
type MessageRecord =
  import('../../../../testutils/server/model-contracts.mts').MessageRecord;
type MessageModel =
  import('../../../../testutils/server/model-contracts.mts').MessageModel;
type OfferRecord =
  import('../../../../testutils/server/model-contracts.mts').OfferRecord;
type OfferModel =
  import('../../../../testutils/server/model-contracts.mts').OfferModel;
type TribeRecord =
  import('../../../../testutils/server/model-contracts.mts').TribeRecord;
type TribeModel =
  import('../../../../testutils/server/model-contracts.mts').TribeModel;
function requireUserDocument(
  user: UserModelDocument | null,
): UserModelDocument {
  if (!user) throw new Error('Expected test user to exist');
  return user;
}
function removalToken(user: UserModelDocument): string {
  if (!user.removeProfileToken) throw new Error('Expected removal token');
  return user.removeProfileToken;
}
function tokenFromRemovalEmail(text: string): string {
  const match = text.match(/\/remove\/([a-f0-9]+)/);
  if (!match?.[1]) throw new Error('Expected removal token in email');
  return match[1];
}
const User = mongoose.model<UserRecord, UserModel>('User');
const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');
const Tribe = mongoose.model<TribeRecord, TribeModel>('Tribe');

/**
 * Globals
 */
let app: TestExpressApp;
let agent: TestAgent;
let credentialsA: Credentials;
let credentialsB: Credentials;
type UserDocument = UserModelDocument;
let userA: UserDocument;
let _userA: UserRecord;
let userB: UserDocument;
let _userB: UserRecord;

/**
 * User routes tests
 */
describe('User removal CRUD tests', function () {
  interface RemovalMailData {
    subject: string;
    to: { address: string };
    text: string;
  }
  const jobs = testutils.catchJobs<RemovalMailData>();
  before(function (done: DoneCallback) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });

  // initialize sinon
  beforeEach(function () {
    const testClockStart = Date.now();
    sinon.useFakeTimers({
      // Use the current clock because Mongo's TTL monitor uses real time.
      now: testClockStart,
      toFake: ['Date'],
    });
  });
  afterEach(function () {
    sinon.restore();
  });

  // Create an user A
  beforeEach(function (done: DoneCallback) {
    // Create user credentials for user A
    credentialsA = {
      username: 'usera',
      password: 'M3@n.jsI$Aw3$0m3',
    };

    // Create a new user A
    _userA = {
      public: true,
      firstName: 'Full',
      lastName: 'Name A',
      displayName: 'Full Name A',
      email: 'user_a@example.com',
      username: credentialsA.username.toLowerCase(),
      password: credentialsA.password,
      provider: 'local',
    };
    userA = new User(_userA);

    // Save a user to the test db
    userA.save(done);
  });

  // Create user B
  beforeEach(function (done: DoneCallback) {
    // Create user credentials for user B
    credentialsB = {
      username: 'userb',
      password: 'M3@n.jsI$Aw3$0m3',
    };

    // Create a new user B
    _userB = {
      public: true,
      firstName: 'Full',
      lastName: 'Name B',
      displayName: 'Full Name B',
      email: 'user_b@example.com',
      username: credentialsB.username.toLowerCase(),
      password: credentialsB.password,
      provider: 'local',
    };
    userB = new User(_userB);

    // Save a user to the test db
    userB.save(done);
  });
  afterEach(dataUtils.clearDatabase);
  it('should not be able to initiate removing profile when not logged in', function (done: DoneCallback) {
    agent
      .del('/api/users')
      .set('X-Trustroots-Request', '1')
      .expect(403)
      .end(function (deleteErr) {
        // Handle signup error
        if (deleteErr) {
          return done(deleteErr);
        }
        jobs.length.should.equal(0);

        // User should still exist
        User.findOne(
          {
            username: userA.username,
          },
          function (
            findUsersErr: Error | null,
            findUser: UserModelDocument | null,
          ) {
            if (findUsersErr) {
              return done(findUsersErr);
            }
            findUser!.username.should.equal(userA.username);
            done();
          },
        );
      });
  });
  it('Signin in should not reveal profile removal tokens', function (done: DoneCallback) {
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    userA.removeProfileExpires = new Date();
    userA.save(function (err: Error | null) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr, signinRes) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          // Sensitive information should be not sent to the client
          should.not.exist(signinRes.body.removeProfileToken);
          should.not.exist(signinRes.body.removeProfileExpires);
          done();
        });
    });
  });
  it('should be able to initiate removing profile when signed in', function (done: DoneCallback) {
    agent
      .post('/api/auth/signin')
      .send(credentialsA)
      .expect(200)
      .end(function (signinErr, signedInUser) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }
        agent
          .del('/api/users')
          .set('X-Trustroots-Request', '1')
          .expect(200)
          .end(function (deleteErr, deleteRes) {
            // Handle signup error
            if (deleteErr) {
              return done(deleteErr);
            }
            deleteRes.body.message.should.equal(
              'We sent you an email with further instructions.',
            );
            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal(
              'Confirm removing your Trustroots profile',
            );
            jobs[0].data.to.address.should.equal(_userA.email);
            User.findById(
              signedInUser.body._id,
              function (
                findUsersErr: Error | null,
                findUser: UserModelDocument | null,
              ) {
                if (findUsersErr) {
                  return done(findUsersErr);
                }
                removalToken(requireUserDocument(findUser)).should.equal(
                  hashToken(tokenFromRemovalEmail(jobs[0].data.text)),
                );
                should.exist(findUser!.removeProfileExpires);
                should.exist(findUser!.removeProfileToken);
                done();
              },
            );
          });
      });
  });
  it('should be able to initiate removing profile when already initiated once earlier', function (done: DoneCallback) {
    agent
      .post('/api/auth/signin')
      .send(credentialsA)
      .expect(200)
      .end(function (signinErr, signedInUser) {
        // Handle signin error
        if (signinErr) {
          return done(signinErr);
        }
        agent
          .del('/api/users')
          .set('X-Trustroots-Request', '1')
          .expect(200)
          .end(function (deleteErr1, deleteRes1) {
            // Handle signup error
            if (deleteErr1) {
              return done(deleteErr1);
            }
            deleteRes1.body.message.should.equal(
              'We sent you an email with further instructions.',
            );
            jobs.length.should.equal(1);
            jobs[0].type.should.equal('send email');
            jobs[0].data.subject.should.equal(
              'Confirm removing your Trustroots profile',
            );
            jobs[0].data.to.address.should.equal(_userA.email);
            User.findById(
              signedInUser.body._id,
              function (
                findUsersErr1: Error | null,
                findUser1: UserModelDocument | null,
              ) {
                if (findUsersErr1) {
                  return done(findUsersErr1);
                }
                removalToken(requireUserDocument(findUser1)).should.equal(
                  hashToken(tokenFromRemovalEmail(jobs[0].data.text)),
                );
                should.exist(findUser1!.removeProfileExpires);
                should.exist(findUser1!.removeProfileToken);

                // Send another delete request
                // This should refresh token to new one so check everything again
                agent
                  .del('/api/users')
                  .set('X-Trustroots-Request', '1')
                  .expect(200)
                  .end(function (deleteErr2, deleteRes2) {
                    // Handle signup error
                    if (deleteErr2) {
                      return done(deleteErr2);
                    }
                    deleteRes2.body.message.should.equal(
                      'We sent you an email with further instructions.',
                    );
                    jobs.length.should.equal(2); // now two because earlier we sent already one
                    jobs[1].type.should.equal('send email');
                    jobs[1].data.subject.should.equal(
                      'Confirm removing your Trustroots profile',
                    );
                    jobs[1].data.to.address.should.equal(_userA.email);
                    User.findById(
                      signedInUser.body._id,
                      function (
                        findUsersErr2: Error | null,
                        findUser2: UserModelDocument | null,
                      ) {
                        if (findUsersErr2) {
                          return done(findUsersErr2);
                        }
                        removalToken(
                          requireUserDocument(findUser2),
                        ).should.equal(
                          hashToken(tokenFromRemovalEmail(jobs[1].data.text)),
                        );
                        should.exist(findUser2!.removeProfileExpires);
                        should.exist(findUser2!.removeProfileToken);
                        done();
                      },
                    );
                  });
              },
            );
          });
      });
  });
  it('should be able to confirm removing profile when signed in', function (done: DoneCallback) {
    userA.removeProfileExpires = new Date(Date.now() + 24 * 3600000);
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    userA.save(function (err, savedUser) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }
          agent
            .del('/api/users/remove/' + savedUser.removeProfileToken)
            .set('X-Trustroots-Request', '1')
            .expect(200)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }
              deleteRes.body.message.should.equal(
                'Your profile has been removed.',
              );
              jobs.length.should.equal(1);
              jobs[0].type.should.equal('send email');
              jobs[0].data.subject.should.equal(
                'Your Trustroots profile has been removed',
              );
              jobs[0].data.to.address.should.equal(_userA.email);
              jobs[0].data.text.should.containEql(
                'Your Trustroots account has been removed.',
              );
              User.findById(
                savedUser._id,
                function (
                  findUsersErr: Error | null,
                  findUser: UserModelDocument | null,
                ) {
                  if (findUsersErr) {
                    return done(findUsersErr);
                  }
                  should.not.exist(findUser);
                  done();
                },
              );
            });
        });
    });
  });
  it('should not able to initiate removing profile with role "shadowban"', function (done: DoneCallback) {
    userA.roles = ['user', 'shadowban'];
    userA.save(function (err: Error | null) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);
          agent
            .del('/api/users')
            .set('X-Trustroots-Request', '1')
            .expect(403)
            .end(function (deleteErr, deleteRes) {
              should.not.exist(deleteErr);
              deleteRes.body.message.should.equal(
                'Oops! Something went wrong. Please get in touch with support at trustroots.org/support',
              );
              jobs.length.should.equal(0);
              done();
            });
        });
    });
  });
  it('should not be able to confirm removing profile when not signed in', function (done: DoneCallback) {
    userA.removeProfileExpires = new Date(Date.now() + 24 * 3600000);
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    userA.save(function (err, savedUser) {
      should.not.exist(err);
      agent
        .del('/api/users/remove/' + savedUser.removeProfileToken)
        .set('X-Trustroots-Request', '1')
        .expect(403)
        .end(function (deleteErr, deleteRes) {
          // Handle signup error
          if (deleteErr) {
            return done(deleteErr);
          }
          deleteRes.body.message.should.equal('Forbidden.');
          jobs.length.should.equal(0);

          // User should still exist
          User.findById(
            savedUser._id,
            function (
              findUsersErr: Error | null,
              findUser: UserModelDocument | null,
            ) {
              if (findUsersErr) {
                return done(findUsersErr);
              }
              removalToken(requireUserDocument(findUser)).should.equal(
                userA.removeProfileToken,
              );
              done();
            },
          );
        });
    });
  });
  it('should not be able to confirm removing profile with wrong token', function (done: DoneCallback) {
    userA.removeProfileExpires = new Date(Date.now() + 24 * 3600000);
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    userA.save(function (err, savedUser) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }
          agent
            .del('/api/users/remove/wrongtoken')
            .set('X-Trustroots-Request', '1')
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }
              deleteRes.body.message.should.equal(
                'Profile remove token is invalid or has expired.',
              );
              jobs.length.should.equal(0);

              // User should still exist
              User.findById(
                savedUser._id,
                function (
                  findUsersErr: Error | null,
                  findUser: UserModelDocument | null,
                ) {
                  if (findUsersErr) {
                    return done(findUsersErr);
                  }
                  removalToken(requireUserDocument(findUser)).should.equal(
                    userA.removeProfileToken,
                  );
                  done();
                },
              );
            });
        });
    });
  });
  it('should not be able to confirm removing profile with expired token', function (done: DoneCallback) {
    userA.removeProfileExpires = new Date(Date.now() - 24 * 3600000); // 24h in the past
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    userA.save(function (err, savedUser) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }
          agent
            .del('/api/users/remove/' + userA.removeProfileToken)
            .set('X-Trustroots-Request', '1')
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }
              deleteRes.body.message.should.equal(
                'Profile remove token is invalid or has expired.',
              );
              jobs.length.should.equal(0);

              // User should still exist
              User.findById(
                savedUser._id,
                function (
                  findUsersErr: Error | null,
                  findUser: UserModelDocument | null,
                ) {
                  if (findUsersErr) {
                    return done(findUsersErr);
                  }
                  removalToken(requireUserDocument(findUser)).should.equal(
                    userA.removeProfileToken,
                  );
                  done();
                },
              );
            });
        });
    });
  });
  it('should not be able to confirm removing profile when signed in as wrong user', function (done: DoneCallback) {
    userA.removeProfileExpires = new Date(Date.now() + 24 * 3600000);
    userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
    userA.save(function (err, savedUser) {
      should.not.exist(err);
      agent
        .post('/api/auth/signin')
        .send(credentialsB) // User B signs in insetead of user A
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }
          agent
            .del('/api/users/remove/' + userA.removeProfileToken)
            .set('X-Trustroots-Request', '1')
            .expect(400)
            .end(function (deleteErr, deleteRes) {
              // Handle signup error
              if (deleteErr) {
                return done(deleteErr);
              }
              deleteRes.body.message.should.equal(
                'Profile remove token is invalid or has expired.',
              );
              jobs.length.should.equal(0);

              // User should still exist
              User.findById(
                savedUser._id,
                function (
                  findUsersErr: Error | null,
                  findUser: UserModelDocument | null,
                ) {
                  if (findUsersErr) {
                    return done(findUsersErr);
                  }
                  removalToken(requireUserDocument(findUser)).should.equal(
                    userA.removeProfileToken,
                  );

                  // Signed in user should still exist
                  User.findOne(
                    {
                      username: userB.username,
                    },
                    function (
                      findUsersErr: Error | null,
                      findUser: UserModelDocument | null,
                    ) {
                      if (findUsersErr) {
                        return done(findUsersErr);
                      }
                      findUser!.username.should.equal(userB.username);
                      should.not.exist(userB.removeProfileExpires);
                      should.not.exist(userB.removeProfileToken);
                      done();
                    },
                  );
                },
              );
            });
        });
    });
  });
  context('logged in & valid token', function () {
    function sendDeleteRequest(cb: StepCallback): void {
      agent
        .del('/api/users/remove/' + userA.removeProfileToken)
        .set('X-Trustroots-Request', '1')
        .expect(200)
        .end(function (deleteErr) {
          cb(deleteErr);
        });
    }

    // sign in
    beforeEach(function (done: DoneCallback) {
      agent
        .post('/api/auth/signin')
        .send(credentialsA)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          return done(signinErr);
        });
    });

    // save removeToken for user a
    beforeEach(function (done: DoneCallback) {
      userA.removeProfileExpires = new Date(Date.now() + 24 * 3600000);
      userA.removeProfileToken = 'c823770bc996ef7aabc9497c57c3ff0a972e7cd6';
      userA.save(done);
    });
    it('should remove profile images', function (done: DoneCallback) {
      // Each user has their own folder for avatars
      const uploadDir =
        path.resolve(config.uploadDir) + '/' + userA._id + '/avatar'; // No trailing slash

      function checkAvatarExistence(
        shouldExist: boolean,
        cb: StepCallback,
      ): void {
        const exists = fs.existsSync(uploadDir);
        try {
          should(exists).eql(shouldExist);
          cb();
        } catch (e) {
          cb(e);
        }
      }
      async.waterfall(
        [
          // Avatar should not exist yet
          checkAvatarExistence.bind(null, false),
          // Upload avatar image
          function (cb: StepCallback) {
            agent
              .post('/api/users-avatar')
              .set('X-Trustroots-Request', '1')
              .attach('avatar', './modules/users/tests/server/img/avatar.png')
              .expect(200)
              .end(function (err: Error | null) {
                cb(err);
              });
          },
          // Avatar should now exist
          checkAvatarExistence.bind(null, true),
          sendDeleteRequest,
          // Avatar should not exist anymore
          checkAvatarExistence.bind(null, false),
        ],
        done,
      );
    });
    it('should mark all messages to the removed user as notified and keep the ones from her untouched', function (done: DoneCallback) {
      async.waterfall(
        [
          // create some unnotified messages between the users
          function (cb: StepCallback) {
            const messageAB = new Message({
              content: 'Message content',
              userFrom: userA._id,
              userTo: userB._id,
              read: false,
            });
            const messageBA = new Message({
              content: 'Message content',
              userFrom: userB._id,
              userTo: userA._id,
              read: false,
            });
            async.each(
              [messageAB, messageBA],
              function (msg, callback) {
                msg.save(callback);
              },
              cb,
            );
          },
          sendDeleteRequest,
          // check that the messages to the removed user are notificationCount: 2
          function (cb: StepCallback) {
            Message.findOne(
              {
                userTo: userA._id,
              },
              function (err: Error | null, msg: MessageRecord | null) {
                if (!msg) return done(new Error('Expected test message'));
                try {
                  should(msg.notificationCount).eql(2);
                  cb();
                } catch (e) {
                  cb(e);
                }
              },
            );
          },
          // check that the messages from the removed user are left unchanged
          function (cb: StepCallback) {
            Message.findOne(
              {
                userFrom: userA._id,
              },
              function (err: Error | null, msg: MessageRecord | null) {
                if (!msg) return done(new Error('Expected test message'));
                try {
                  should(msg.notificationCount).eql(0);
                  cb();
                } catch (e) {
                  cb(e);
                }
              },
            );
          },
        ],
        done,
      );
    });
    it('should subtract 1 from tribes.count for each tribe user is member of', function (done: DoneCallback) {
      let tribeA: import('mongoose').HydratedDocument<TribeRecord>;
      let tribeB: import('mongoose').HydratedDocument<TribeRecord>;
      async.waterfall(
        [
          // Create some tribes
          function (cb: StepCallback) {
            tribeA = new Tribe({
              label: 'Tribe A',
              attribution: 'Photo credits',
              attribution_url: 'http://www.trustroots.org/team',
              image_UUID: '3c8bb9f1-e313-4baa-bf4c-1d8994fd6c6c',
              description: 'Lorem ipsum.',
              count: 5,
            });
            tribeB = new Tribe({
              label: 'Tribe B',
              attribution: 'Photo credits',
              attribution_url: 'http://www.trustroots.org/team2',
              image_UUID: '3c8bb9f1-e313-4baa-bf4c-1d8994fd6c6d',
              description: 'Lorem ipsum.',
              count: 5,
            });
            async.each(
              [tribeA, tribeB],
              function (tribe, callback) {
                tribe.save(callback);
              },
              cb,
            );
          },
          // join the tribeA with the removed user
          function (cb: StepCallback) {
            agent
              .post('/api/users/memberships/' + tribeA._id)
              .set('X-Trustroots-Request', '1')
              .send()
              .expect(200)
              .end(function (err: Error | null) {
                cb(err);
              });
          },
          // now the tribeA should have count 6
          function (cb: StepCallback) {
            Tribe.findById(
              tribeA._id,
              function (err: Error | null, tribe: TribeRecord | null) {
                if (!tribe) throw new Error('Expected test tribe');
                try {
                  should(tribe.count).eql(6);
                  cb();
                } catch (e) {
                  cb(e);
                }
              },
            );
          },
          sendDeleteRequest,
          // tribeA should have lower count by 1 (5 -> 6 -> 5 now)
          function (cb: StepCallback) {
            Tribe.findById(
              tribeA._id,
              function (err: Error | null, tribe: TribeRecord | null) {
                if (!tribe) throw new Error('Expected test tribe');
                try {
                  should(tribe.count).eql(5);
                  cb();
                } catch (e) {
                  cb(e);
                }
              },
            );
          },
          // tribeB should have count 5 all the time
          function (cb: StepCallback) {
            Tribe.findById(
              tribeB._id,
              function (err: Error | null, tribe: TribeRecord | null) {
                if (!tribe) throw new Error('Expected test tribe');
                try {
                  should(tribe.count).eql(5);
                  cb();
                } catch (e) {
                  cb(e);
                }
              },
            );
          },
        ],
        done,
      );
    });
    it('should remove hosting offer of the user', function (done: DoneCallback) {
      async.waterfall(
        [
          // Create an offer for the user
          function (cb: StepCallback) {
            const offer = new Offer({
              user: userA._id,
              location: [0, 0],
            });
            offer.save(function (err: Error | null) {
              cb(err);
            });
          },
          // at the beginning 1 offer should exist in database
          function (cb: StepCallback) {
            Offer.find(
              {
                user: userA._id,
              },
              function (err: Error | null, offer: OfferRecord[]) {
                try {
                  should(offer).length(1);
                  cb();
                } catch (e) {
                  cb(e);
                }
              },
            );
          },
          sendDeleteRequest,
          // now the offer shouldn't be there
          function (cb: StepCallback) {
            Offer.find(
              {
                user: userA._id,
              },
              function (err: Error | null, offers: OfferRecord[]) {
                try {
                  should(offers).length(0);
                  cb();
                } catch (e) {
                  cb(e);
                }
              },
            );
          },
        ],
        done,
      );
    });
    it('should remove contacts of the user', function (done: DoneCallback) {
      let userC: UserModelDocument;
      async.waterfall(
        [
          // create a 3rd user
          function (cb: StepCallback) {
            userC = new User({
              public: true,
              firstName: 'Full',
              lastName: 'Name C',
              displayName: 'Full Name C',
              email: 'user_c@example.com',
              username: 'userc',
              password: '**********asdfasdf',
              provider: 'local',
            });
            userC.save(function (err: Error | null) {
              cb(err);
            });
          },
          // add contacts between the users
          function (cb: StepCallback) {
            const contactAB = new Contact({
              userFrom: userA._id,
              userTo: userB._id,
              confirmed: true,
            });
            const contactBC = new Contact({
              userFrom: userB._id,
              userTo: userC._id,
              confirmed: true,
            });
            const contactCA = new Contact({
              userFrom: userC._id,
              userTo: userA._id,
              confirmed: false,
            });
            async.each(
              [contactAB, contactBC, contactCA],
              function (contact, callback) {
                contact.save(callback);
              },
              cb,
            );
          },
          // 3 contacts should exist
          function (cb: StepCallback) {
            Contact.find().exec(function (err, contacts) {
              cb(null, contacts);
            });
          },
          function (contacts: unknown, cb: StepCallback) {
            try {
              should(contacts).length(3);
              cb();
            } catch (e) {
              cb(e);
            }
          },
          sendDeleteRequest,
          // only 1 contact should exist now (the one between users B and C)
          function (cb: StepCallback) {
            Contact.find().exec(function (err, contacts) {
              cb(null, contacts);
            });
          },
          function (contacts: unknown, cb: StepCallback) {
            try {
              should(contacts).length(1);
              cb();
            } catch (e) {
              cb(e);
            }
          },
        ],
        done,
      );
    });
  });
});

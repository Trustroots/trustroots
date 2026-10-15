import type {
  Credentials,
  MessageModel,
  MessageRecord,
  ReferenceThreadModel,
  ReferenceThreadRecord,
  TestAgent,
  TestExpressApp,
  TestExpressModule,
  ThreadModel,
  ThreadRecord,
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
type WaterfallDone = (error?: Error | null) => void;
const async: {
  waterfall(
    tasks: Array<(done: WaterfallDone) => void>,
    callback: WaterfallDone,
  ): void;
} = require('async');
const request: typeof import('supertest') = require('supertest');
const moment: typeof import('moment') = require('moment');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');
const Thread = mongoose.model<ThreadRecord, ThreadModel>('Thread');
const ReferenceThread = mongoose.model<
  ReferenceThreadRecord,
  ReferenceThreadModel
>('ReferenceThread');

/**
 * Globals
 */
let app: TestExpressApp;
let agent: TestAgent;
let userFrom: UserModelDocument;
let referenceUserFromId: UserModelDocument['_id'];
let referenceUserFromCredentials: Credentials;
let userTo: UserModelDocument;
let referenceUserToId: UserModelDocument['_id'];
let userNonPublic: UserModelDocument;
let referenceUserNonPublicId: UserModelDocument['_id'];
let referenceUserNonpublicCredentials: Credentials;
let referenceThread: Omit<
  ReferenceThreadRecord,
  'thread' | 'userFrom' | 'userTo'
> &
  Partial<Pick<ReferenceThreadRecord, 'thread' | 'userFrom' | 'userTo'>>;
let message: Omit<MessageRecord, 'userFrom' | 'userTo'> & {
  userFrom: MessageRecord['userFrom'] | null;
  userTo: MessageRecord['userTo'] | null;
  notified: boolean;
};
let thread: Omit<ThreadRecord, 'message' | 'userFrom' | 'userTo'> & {
  message: ThreadRecord['message'] | null;
  userFrom: ThreadRecord['userFrom'] | null;
  userTo: ThreadRecord['userTo'] | null;
};
let threadId: import('mongoose').Types.ObjectId;
let threadNonpublicId: import('mongoose').Types.ObjectId;

/**
 * Message routes tests
 */
describe('Reference Thread CRUD tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  beforeEach(function (done) {
    // Create userFrom credentials
    referenceUserFromCredentials = {
      username: 'userfrom',
      password: 'password123!',
    };
    referenceUserNonpublicCredentials = {
      username: 'usernonpublic',
      password: 'password123!',
    };
    userFrom = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user_from@test.com',
      username: referenceUserFromCredentials.username,
      password: referenceUserFromCredentials.password,
      provider: 'local',
      public: true,
    });
    userTo = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user_to@test.com',
      username: 'userto',
      password: 'password123!',
      provider: 'local',
      public: true,
    });
    userNonPublic = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'userNonPublic@test.com',
      username: referenceUserNonpublicCredentials.username,
      password: referenceUserNonpublicCredentials.password,
      provider: 'local',
      public: false,
    });
    message = {
      content: 'Lorem ipsum',
      notified: true,
      userTo: null,
      userFrom: null,
      read: true,
      created: new Date(),
    };
    thread = {
      message: null,
      userTo: null,
      userFrom: null,
      read: true,
      updated: new Date(),
    };
    referenceThread = {
      // thread: null,
      // userFrom: null,
      // userTo: null,
      reference: 'yes',
      created: new Date(),
    };

    // Create users, messages and prepare references

    async.waterfall(
      [
        // Create userNonPublic
        function (stepDone) {
          utils.saveUserWithCachedPassword(userNonPublic).then(function (res) {
            referenceUserNonPublicId = res._id;
            stepDone();
          }, stepDone);
        },
        // Create userFrom
        function (stepDone) {
          utils.saveUserWithCachedPassword(userFrom).then(function (res) {
            referenceUserFromId = res._id;
            stepDone();
          }, stepDone);
        },
        // Create userTo
        function (stepDone) {
          utils.saveUserWithCachedPassword(userTo).then(function (res) {
            referenceUserToId = res._id;
            referenceThread.userTo = referenceUserToId;
            stepDone();
          }, stepDone);
        },
        // Create message+thread between referenceUserTo and referenceUserFrom
        function (stepDone) {
          // Note that from/to are opposite in these by purpose
          // `referenceUserTo` is the receiver of messages, and thus that user can leave reference, not the other way around.
          message.userTo = referenceUserFromId;
          message.userFrom = referenceUserToId;
          thread.userTo = referenceUserFromId;
          thread.userFrom = referenceUserToId;
          new Message(message)
            .save()
            .then(function (messageRes) {
              thread.message = messageRes._id;
              return new Thread(thread).save();
            })
            .then(function (threadRes) {
              threadId = threadRes._id;
              stepDone();
            })
            .catch(stepDone);
        },
        // Create message+thread between userTo and userNonPublic
        function (stepDone) {
          // Note that from/to are opposite in these by purpose
          // `referenceUserTo` is the receiver of messages, and thus that user can leave reference, not the other way around.
          message.userTo = referenceUserNonPublicId;
          message.userFrom = referenceUserToId;
          thread.userTo = referenceUserNonPublicId;
          thread.userFrom = referenceUserToId;
          new Message(message)
            .save()
            .then(function (messageRes) {
              thread.message = messageRes._id;
              return new Thread(thread).save();
            })
            .then(function (threadRes) {
              threadNonpublicId = threadRes._id;
              stepDone();
            })
            .catch(stepDone);
        },
      ],
      function (err) {
        done(err);
      },
    );
  });
  afterEach(utils.clearDatabase);
  it('should not be able to read references if not logged in', function (done) {
    agent
      .get('/api/references-thread/' + referenceUserToId)
      .expect(403)
      .end(function (referenceReadErr, referenceReadRes) {
        referenceReadRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(referenceReadErr);
      });
  });
  it('should be able to read reference even if logged in as non-public user', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserNonpublicCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Save a new reference
        referenceThread.userFrom = referenceUserNonPublicId;
        referenceThread.thread = threadNonpublicId;
        new ReferenceThread(referenceThread).save().then(
          function () {
            const referenceThreadErr = null;

            // Handle error
            if (referenceThreadErr) return done(referenceThreadErr);

            // Read reference
            agent
              .get('/api/references-thread/' + referenceUserToId)
              .expect(200)
              .end(function (referenceReadErr, referenceReadRes) {
                referenceReadRes.body.userFrom.should.equal(
                  referenceUserNonPublicId.toString(),
                );
                referenceReadRes.body.userTo.should.equal(
                  referenceUserToId.toString(),
                );
                referenceReadRes.body.thread.should.equal(
                  threadNonpublicId.toString(),
                );
                referenceReadRes.body.reference.should.equal('yes');
                should.exist(referenceReadRes.body.created);

                // Call the assertion callback
                return done(referenceReadErr);
              });
          },
          function (referenceThreadErr) {
            if (typeof done === 'function') return done(referenceThreadErr);
            throw referenceThreadErr;
          },
        );
      });
  });
  it('should be able to read reference if logged in', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserFromCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Save a new reference
        referenceThread.userFrom = referenceUserFromId;
        referenceThread.thread = threadId;
        new ReferenceThread(referenceThread).save().then(
          function () {
            const referenceThreadErr = null;

            // Handle error
            if (referenceThreadErr) return done(referenceThreadErr);

            // Read reference
            agent
              .get('/api/references-thread/' + referenceUserToId)
              .expect(200)
              .end(function (referenceReadErr, referenceReadRes) {
                referenceReadRes.body.userFrom.should.equal(
                  referenceUserFromId.toString(),
                );
                referenceReadRes.body.userTo.should.equal(
                  referenceUserToId.toString(),
                );
                referenceReadRes.body.thread.should.equal(threadId.toString());
                referenceReadRes.body.reference.should.equal('yes');
                should.exist(referenceReadRes.body.created);

                // Call the assertion callback
                return done(referenceReadErr);
              });
          },
          function (referenceThreadErr) {
            if (typeof done === 'function') return done(referenceThreadErr);
            throw referenceThreadErr;
          },
        );
      });
  });
  it("does not expose another member's reference thread", async () => {
    referenceThread.userFrom = referenceUserNonPublicId;
    referenceThread.thread = threadNonpublicId;
    await new ReferenceThread(referenceThread).save();

    await agent
      .post('/api/auth/signin')
      .send(referenceUserFromCredentials)
      .expect(200);
    const response = await agent
      .get('/api/references-thread/' + referenceUserToId)
      .expect(404);
    response.body.message.should.equal('Not found.');
    response.body.allowCreatingReference.should.equal(true);

    await agent
      .post('/api/auth/signin')
      .send(referenceUserNonpublicCredentials)
      .expect(200);
    const participantResponse = await agent
      .get('/api/references-thread/' + referenceUserToId)
      .expect(200);
    participantResponse.body.userFrom.should.equal(
      referenceUserNonPublicId.toString(),
    );
    participantResponse.body.thread.should.equal(threadNonpublicId.toString());
  });
  it('should be able to attempt reading non-existing reference and told she can create a reference', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserFromCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Read reference
        agent
          .get('/api/references-thread/' + referenceUserToId)
          .expect(404)
          .end(function (referenceReadErr, referenceReadRes) {
            referenceReadRes.body.message.should.equal('Not found.');

            // Since authenticated user has received messages from the other user
            // authenticated user should be told that she will be allowed leave references
            referenceReadRes.body.allowCreatingReference.should.equal(true);

            // Call the assertion callback
            return done(referenceReadErr);
          });
      });
  });
  it('should be able to attempt reading non-existing reference and told she cannot create a reference', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserFromCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Remove message threads completely
        Message.deleteMany()
          .exec()
          .then(function () {
            Thread.deleteMany()
              .exec()
              .then(function () {
                // Read reference
                agent
                  .get('/api/references-thread/' + referenceUserToId)
                  .expect(404)
                  .end(function (referenceReadErr, referenceReadRes) {
                    referenceReadRes.body.message.should.equal('Not found.');

                    // Since authenticated user has NOT received messages from the other user
                    // authenticated user should be told that she will NOT BE allowed leave references
                    referenceReadRes.body.allowCreatingReference.should.equal(
                      false,
                    );

                    // Call the assertion callback
                    return done(referenceReadErr);
                  });
              })
              .catch(function (mongooseErr) {
                if (typeof done === 'function') return done(mongooseErr);
                throw mongooseErr;
              });
          })
          .catch(err => done(err));
      });
  });
  it('should not be able to create reference if not logged in', function (done) {
    agent
      .post('/api/references-thread')
      .send(referenceThread)
      .expect(403)
      .end(function (referenceSaveErr, referenceSaveRes) {
        referenceSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(referenceSaveErr);
      });
  });
  it('should not be able to create reference if logged in as non-public user, even if there are messages', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserNonpublicCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Save a new reference
        agent
          .post('/api/references-thread')
          .send(referenceThread)
          .expect(403)
          .end(function (referenceSaveErr, referenceSaveRes) {
            // Handle reference save error
            if (referenceSaveErr) return done(referenceSaveErr);
            referenceSaveRes.body.message.should.equal('Forbidden.');
            return done();
          });
      });
  });
  it('should not be able to create reference for myself', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserFromCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Save a new reference
        referenceThread.userTo = referenceUserFromId;
        agent
          .post('/api/references-thread')
          .send(referenceThread)
          .expect(400)
          .end(function (referenceSaveErr, referenceSaveRes) {
            // Handle reference save error
            if (referenceSaveErr) return done(referenceSaveErr);
            referenceSaveRes.body.message.should.equal(
              'Thread does not exist.',
            );
            return done();
          });
      });
  });
  it('should be able to create reference if logged in', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserFromCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Save a new reference
        agent
          .post('/api/references-thread')
          .send(referenceThread)
          .expect(200)
          .end(function (referenceSaveErr, referenceSaveRes) {
            // Handle reference save error
            if (referenceSaveErr) return done(referenceSaveErr);
            referenceSaveRes.body.userFrom.should.equal(
              referenceUserFromId.toString(),
            );
            referenceSaveRes.body.userTo.should.equal(
              referenceUserToId.toString(),
            );
            referenceSaveRes.body.thread.should.equal(threadId.toString());
            referenceSaveRes.body.reference.should.equal('yes');
            should.exist(referenceSaveRes.body.created);
            return done();
          });
      });
  });
  it('should be able to create two references and receive only latest one when reading', function (done) {
    agent
      .post('/api/auth/signin')
      .send(referenceUserFromCredentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);
        referenceThread.reference = 'yes';
        referenceThread.userFrom = referenceUserFromId;
        referenceThread.thread = threadId;

        // Set date to past for reference to be saved directly to the DB:
        referenceThread.created = moment()
          .subtract(
            moment.duration({
              hours: 24,
            }),
          )
          .toDate();

        // Save 1st new reference ("yes") directly to the DB:
        new ReferenceThread(referenceThread).save().then(
          function () {
            const referenceThreadErr = null;

            if (referenceThreadErr) return done(referenceThreadErr);

            // Save 2st new reference ("no") via API
            referenceThread.reference = 'no';
            agent
              .post('/api/references-thread')
              .send(referenceThread)
              .expect(200)
              .end(function (referenceSaveErr) {
                // Handle reference save error
                if (referenceSaveErr) return done(referenceSaveErr);

                // Check DB has two entries
                ReferenceThread.find({
                  userFrom: referenceUserFromId,
                })
                  .sort('-created') // Latest first
                  .exec()
                  .then(function (referenceThreadFindRes) {
                    const referenceThreadFindErr = null;

                    if (referenceThreadFindErr) return done(referenceSaveErr);

                    // We should have two references
                    referenceThreadFindRes.length.should.equal(2);

                    // They should be identical...
                    referenceThreadFindRes[0].userTo
                      .toString()
                      .should.equal(
                        referenceThreadFindRes[1].userTo.toString(),
                      );
                    referenceThreadFindRes[0].userFrom
                      .toString()
                      .should.equal(
                        referenceThreadFindRes[1].userFrom.toString(),
                      );
                    referenceThreadFindRes[0].thread
                      .toString()
                      .should.equal(
                        referenceThreadFindRes[1].thread.toString(),
                      );

                    // Apart from this:
                    referenceThreadFindRes[0].reference.should.equal('no');
                    referenceThreadFindRes[1].reference.should.equal('yes');

                    // Dates should have ~24h difference (when rounded, there might be a few seconds extra due time it takes to run tests)
                    moment()
                      .diff(referenceThreadFindRes[1].created, 'hours')
                      .should.equal(24);

                    // Read reference
                    agent
                      .get('/api/references-thread/' + referenceUserToId)
                      .expect(200)
                      .end(function (referenceReadErr, referenceReadRes) {
                        if (referenceReadErr) return done(referenceReadErr);
                        referenceReadRes.body.userFrom.should.equal(
                          referenceUserFromId.toString(),
                        );
                        referenceReadRes.body.userTo.should.equal(
                          referenceUserToId.toString(),
                        );
                        referenceReadRes.body.thread.should.equal(
                          threadId.toString(),
                        );
                        referenceReadRes.body.reference.should.equal('no');
                        should.exist(referenceReadRes.body.created);

                        // Call the assertion callback
                        return done();
                      });
                  })
                  .catch(function (referenceThreadFindErr) {
                    if (typeof done === 'function')
                      return done(referenceThreadFindErr);
                    throw referenceThreadFindErr;
                  });
              });
          },
          function (referenceThreadErr) {
            if (typeof done === 'function') return done(referenceThreadErr);
            throw referenceThreadErr;
          },
        );
      });
  });
});

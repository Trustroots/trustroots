const should = require('should');
const async = require('async');
const request = require('supertest');
const path = require('path');
const moment = require('moment');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Message = mongoose.model('Message');
const Thread = mongoose.model('Thread');
const ReferenceThread = mongoose.model('ReferenceThread');

/**
 * Globals
 */
let app;
let agent;
let userFrom;
let referenceUserFromId;
let referenceUserFromCredentials;
let userTo;
let referenceUserToId;
let userNonPublic;
let referenceUserNonPublicId;
let referenceUserNonpublicCredentials;
let referenceThread;
let message;
let thread;
let threadId;
let threadNonpublicId;

/**
 * Message routes tests
 */
describe('Reference Thread CRUD tests', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Create userFrom credentials
    referenceUserFromCredentials = {
      username: 'user_from',
      password: 'password123!',
    };

    referenceUserNonpublicCredentials = {
      username: 'user_non_public',
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
      username: 'user_to',
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
          userNonPublic.save(function (err, res) {
            referenceUserNonPublicId = res._id;
            stepDone(err);
          });
        },

        // Create userFrom
        function (stepDone) {
          userFrom.save(function (err, res) {
            referenceUserFromId = res._id;
            stepDone(err);
          });
        },

        // Create userTo
        function (stepDone) {
          userTo.save(function (err, res) {
            referenceUserToId = res._id;
            referenceThread.userTo = referenceUserToId;
            stepDone(err);
          });
        },

        // Create message+thread between referenceUserTo and referenceUserFrom
        function (stepDone) {
          // Note that from/to are opposite in these by purpose
          // `referenceUserTo` is the receiver of messages, and thus that user can leave reference, not the other way around.
          message.userTo = referenceUserFromId;
          message.userFrom = referenceUserToId;
          thread.userTo = referenceUserFromId;
          thread.userFrom = referenceUserToId;
          new Message(message).save(function (err, messageRes) {
            if (err) return stepDone(err);

            thread.message = messageRes._id;
            new Thread(thread).save(function (err, threadRes) {
              threadId = threadRes._id;
              stepDone(err);
            });
          });
        },

        // Create message+thread between userTo and userNonPublic
        function (stepDone) {
          // Note that from/to are opposite in these by purpose
          // `referenceUserTo` is the receiver of messages, and thus that user can leave reference, not the other way around.
          message.userTo = referenceUserNonPublicId;
          message.userFrom = referenceUserToId;
          thread.userTo = referenceUserNonPublicId;
          thread.userFrom = referenceUserToId;
          new Message(message).save(function (err, messageRes) {
            if (err) return stepDone(err);

            thread.message = messageRes._id;
            new Thread(thread).save(function (err, threadRes) {
              threadNonpublicId = threadRes._id;
              return done(err);
            });
          });
        },
      ],
      function (err) {
        if (err) {
          done(err);
        }
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
        new ReferenceThread(referenceThread).save(function (
          referenceThreadErr,
        ) {
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
        });
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
        new ReferenceThread(referenceThread).save(function (
          referenceThreadErr,
        ) {
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
        });
      });
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
        Message.deleteMany().exec(function () {
          Thread.deleteMany().exec(function () {
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
          });
        });
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
          .subtract(moment.duration({ hours: 24 }))
          .toDate();

        // Save 1st new reference ("yes") directly to the DB:
        new ReferenceThread(referenceThread).save(function (
          referenceThreadErr,
        ) {
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
              ReferenceThread.find({ userFrom: referenceUserFromId })
                .sort('-created') // Latest first
                .exec(function (
                  referenceThreadFindErr,
                  referenceThreadFindRes,
                ) {
                  if (referenceThreadFindErr) return done(referenceSaveErr);

                  // We should have two references
                  referenceThreadFindRes.length.should.equal(2);

                  // They should be identical...
                  referenceThreadFindRes[0].userTo
                    .toString()
                    .should.equal(referenceThreadFindRes[1].userTo.toString());
                  referenceThreadFindRes[0].userFrom
                    .toString()
                    .should.equal(
                      referenceThreadFindRes[1].userFrom.toString(),
                    );
                  referenceThreadFindRes[0].thread
                    .toString()
                    .should.equal(referenceThreadFindRes[1].thread.toString());

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
                });
            });
        });
      });
  });
});

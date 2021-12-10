/**
 * Module dependencies.
 */
const should = require('should');
const mongoose = require('mongoose');
const path = require('path');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Thread = mongoose.model('Thread');
const Message = mongoose.model('Message');
const ReferenceThread = mongoose.model('ReferenceThread');

/**
 * Globals
 */
let user1;
let user2;
let message;
let thread;
let referenceThread;

/**
 * Unit tests
 */
describe('Reference Thread Model Unit Tests:', function () {
  beforeEach(function (done) {
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
    });

    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
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
      thread: null,
      userFrom: null,
      userTo: null,
      reference: 'yes',
      created: new Date(),
    };

    // Create users and reference
    user1.save(function (err, user1res) {
      referenceThread.userFrom = user1res._id;
      message.userFrom = user1res._id;
      thread.userFrom = user1res._id;
      user2.save(function (err, user2res) {
        referenceThread.userTo = user2res._id;
        message.userTo = user2res._id;
        thread.userTo = user2res._id;
        new Message(message).save(function (err, message2res) {
          thread.message = message2res._id;
          new Thread(thread).save(function (err, thread2res) {
            referenceThread.thread = thread2res._id;
            referenceThread = new ReferenceThread(referenceThread);
            return done();
          });
        });
      });
    });
  });

  afterEach(utils.clearDatabase);

  describe('Method Save', function () {
    it('should be able to save without problems', function (done) {
      referenceThread.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to save without problems with reference text set to "no"', function (done) {
      referenceThread.reference = 'no';

      referenceThread.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to save with reference text set to something else than "yes" or "no"', function (done) {
      referenceThread.reference = 'beer';

      referenceThread.save(function (err) {
        should.exist(err);
        return done();
      });
    });
  });
});

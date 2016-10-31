'use strict';

/**
 * Module dependencies.
 */
var should = require('should'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    ThreadStat = mongoose.model('ThreadStat');

/**
 * Globals
 */
var user0,
    user1,
    thread,
    message;

/**
 * Unit tests
 */
describe('ThreadStats Model', function () {
  beforeEach(function(/* done */) {

    user0 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local'
    });

    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local'
    });

    message = new Message({
      content: 'Message content',
      userFrom: user0._id,
      userTo: user1._id,
      read: false
    });

    thread = new Thread({
      userFrom: user0._id,
      userTo: user1._id,
      message: message._id
    });
  });

  afterEach(function (done) {
    ThreadStat.remove().exec(done);
  });

  it('new ThreadStat should have specific fields', function () {
    var threadStat = new ThreadStat({
      thread: thread._id,
      firstMessageUserFrom: user0._id,
      firstMessageUserTo: user1._id,
      firstMessageCreated: message.created,
      firstMessageLength: message.content.length
    });

    threadStat.should.have.property('_id');
    threadStat.should.have.property('thread');
    threadStat.should.have.property('firstMessageUserFrom');
    threadStat.should.have.property('firstMessageUserTo');
    threadStat.should.have.property('firstMessageCreated');
    threadStat.should.have.property('firstMessageLength');
    threadStat.should.have.property('firstReplyCreated', null);
    threadStat.should.have.property('firstReplyLength', null);
    threadStat.should.have.property('firstReplyTime', null);
  });
  // the expected fields:
  // thread: id of the thread the messages belong to
  // firstMessageUserFrom: id of the first sender
  // firstMessageUserTo: id of the first receiver
  // firstMessageCreated: Date
  // firstMessageLength: number
  // firstReplyCreated: Date
  // firstReplyLength: number
  // firstReplyTime: number
  // // messageCount: number (not now)
  it('should save without problems', function (done) {
    var threadStat = new ThreadStat({
      thread: thread._id,
      firstMessageUserFrom: user0._id,
      firstMessageUserTo: user1._id,
      firstMessageCreated: message.created,
      firstMessageLength: message.content.length
    });

    threadStat.save(function (err) {
      should.not.exist(err);
      return done();
    });
  });
});

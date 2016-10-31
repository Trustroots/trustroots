'use strict';

var async = require('async'),
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    ThreadStat = mongoose.model('ThreadStat');

/**
 * Provided Thread and Message, this function will create or update the
 * ThreadStat belonging to the Thread and Message provided
 */
exports.updateThreadStat = function (thread, message, callback) {

  /**
   * Creates & saves a new ThreadStat document
   */
  function createThreadStat(thread, message, done) {
    var threadStat = new ThreadStat({
      thread: thread._id,
      firstMessageUserFrom: message.userFrom,
      firstMessageUserTo: message.userTo,
      firstMessageCreated: message.created,
      firstMessageLength: message.content.length
    });

    threadStat.save(done);
  }

  /**
   * update the ThreadStat with a first reply information
   */
  function addFirstReplyInfo (threadStat, message, done) {
    ThreadStat.findOneAndUpdate({
      thread: threadStat.thread,
      firstMessageUserFrom: message.userTo,
      firstMessageUserTo: message.userFrom,
      firstReplyCreated: null
    }, {
      $set: {
        firstReplyCreated: message.created,
        firstReplyLength: message.content.length,
        firstReplyTime: message.created.getTime() - threadStat.firstMessageCreated.getTime()
      }
    })
    .exec(done);
  }

  async.waterfall([

    // find the ThreadStat if exists
    function (done) {
      ThreadStat.findOne({ thread: thread._id }, function (err, threadStat) {
        if (err) return done(err);
        Message.find({
          $or: [
            { userFrom: message.userFrom, userTo: message.userTo },
            { userFrom: message.userTo, userTo: message.userFrom }
          ]
        }, function (err, messages) {
          if (err) return done(err);
          return done(null, threadStat, messages);
        });
      });
    },

    // find the older messages (to check if the thread was not started before
    // this was implemented)
    function (threadStat, messages, done) {

      // did the thread exist before? (find out based on old messages);
      var isThreadCreatedNow = (messages.length === 0)
        || (messages.length === 1
          && String(messages[0]._id) === String(message._id));

      // did the thread start before this controller existed?
      var isOld = !isThreadCreatedNow && threadStat === null;

      // is first? when threadStat doesn't exist yet
      var isFirst = !isOld && threadStat === null;

      // is firstReply? when threadStat exists, but has firstReply info null
      var isFirstReply = !isFirst && !isOld
        && String(threadStat.firstMessageUserFrom) === String(message.userTo)
        && threadStat.firstReplyCreated === null;

      // when the thread existed before without ThreadStat, ignore
      // if we didn't ignore this case, the data saved would be wrong
      // to fix the historic cases we'll need to write a script
      if (isOld) {
        return done(null, 'historic');

      } else if (isFirst) {

        // when the message was the first one
        createThreadStat(thread, message, function (err) {
          if (err) return done(err);
          return done(null, 'first');
        });

      } else if (isFirstReply) {
        // when the message was the first reply

        addFirstReplyInfo(threadStat, message, function (err) {
          if (err) return done(err);
          return done(null, 'firstReply');
        });

      } else {
        // otherwise do nothing
        return done(null, 'other');
      }
    }

  ], function (err, response) {
    if (err) return callback(err);
    callback(null, response);
  });
};

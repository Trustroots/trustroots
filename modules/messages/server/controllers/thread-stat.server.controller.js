'use strict'

var async = require('async'),
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    ThreadStat = mongoose.model('ThreadStat');

exports.updateThreadStat = function (thread, message, callback) {

  // this will add
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

  function addFirstReplyInfo (threadStat, message, done) {
    ThreadStat.findOneAndUpdate({
      thread: threadStat.thread,
      firstMessageUserFrom: message.userTo,
      firstMessageUserTo: message.userFrom
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
        })
      });
    },

    // find the older messages (to check if the thread was not started before
    // this was implemented)
    function (threadStat, messages, done) {

      // did the thread exist before? (find out based on old messages);
      var isThreadCreatedNow = (messages.length === 0)
        || (messages.length === 1
          && String(messages[0]._id) === String(message._id));

      // the thread started before this existed
      var isOld = !isThreadCreatedNow && threadStat === null;

      // is first when threadStat doesn't exist yet
      var isFirst = !isOld && threadStat === null;

      // is firstReply when threadStat exists, but has firstReply info null
      var isFirstReply = !isFirst
        && String(threadStat.firstMessageUserFrom) === String(message.userTo)
        && threadStat.firstReplyCreated === null;


      // when the thread existed before without ThreadStat, ignore
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
  // and return if success
  //
  // we'll update the threadStat when the message is sent by the receiver
  // and the fields are null
  //
  // we'll do nothing otherwise

};

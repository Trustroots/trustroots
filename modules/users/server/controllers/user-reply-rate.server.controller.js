'use strict';
/**
 * Module dependencies.
 */
var path = require('path'),
    async = require('async'),
    mongoose = require('mongoose');

require(path.resolve('./modules/messages/server/models/message.server.model'));
require(path.resolve('./modules/users/server/models/user.server.model'));

var Message = mongoose.model('Message');
var User = mongoose.model('User');
var ObjectId = mongoose.Types.ObjectId;

/**
 * A callback for the asynchronous exports.read
 *
 * @callback readCallback
 * @param {error} error
 * @param {Object} result
 * @param {string} result.replyRate - user's reply rate in %
 * @param {string} result.replyTime - user's average reply time described
 */

/**
 * (asynchronous)
 * Read from database and process the replyRate of user with userId
 *
 * @param {string|ObjectId} userId - id of user to get the replyRate from
 * @param {readCallback} callback - result is object with parameters replyRate
 * and replyTime
 */
exports.read = function (userId, callback) {
  exports.readFromDatabase(new ObjectId(userId), function (err, result) {
    if (err) {
      return callback(err);
    }

    var processed = exports.process(result);
    return callback(null, processed);
  });
};

/**
 * A callback for the asynchronous exports.readFromDatabase
 *
 * @callback readFromDatabaseCallback
 * @param {error} error
 * @param {Object} result
 * @param {number} result.replied - amount of user's replied threads
 * @param {number} result.notReplied - amount of user's unreplied threads
 * @param {number|null} result.replyTime - average reply time of user in ms,
 * null when result.replied === 0
 */

/**
 * (asynchronous)
 * Read amount of replied threads, not replied threads and average reply time
 * of user with userId
 *
 * @param {string|ObjectId} userId - id of user to get the replyRate from
 * @param {readFromDatabaseCallback} callback
 */
exports.readFromDatabase = function (userId, callback) {
  async.waterfall([
    function (done) {
      // we want to get amount of replied and notReplied threads, and average
      // replyTime of user with userId which she didn't start and which were
      // started more than 6 months ago (approximated to 180 days)
      Message.aggregate([
        // match all the messages which user either sent or received
        {
          $match: {
            $or: [
              { userFrom: userId },
              { userTo: userId }
            ]
          }
        },
        // sort from oldest to newest
        {
          $sort: { created: 1 }
        },
        // group messages into the threads
        // note whether our user was sender (fromMe = true)
        {
          $group: {
            _id: { $cond: [
              { $eq: ['$userFrom', userId] },
              '$userTo',
              '$userFrom'
            ] },
            messages: {
              $push: {
                fromMe: { $cond: [
                  { $eq: ['$userFrom', userId] },
                  true,
                  false
                ] },
                created: '$created'
              }
            }
          }
        },
        // keep only threads which user didn't start
        // keep only threads started less than 180 days ago
        {
          $match: {
            'messages.0.fromMe': false,
            'messages.0.created': {
              $gt: new Date(Date.now() - 180 * 24 * 3600 * 1000)
            }
          }
        },
        // rename _id => id
        {
          $project: {
            messages: 1,
            id: '$_id',
            _id: 0
          }
        },
        // release messages from the threads
        {
          $unwind: '$messages'
        },
        // sort from oldest to newest
        {
          $sort: { created: 1 }
        },
        // group messages into groups separated by thread and whether sent or
        // received
        // We have a group for sent/received messages of each thread
        {
          $group: {
            _id: { id: '$id', fromMe: '$messages.fromMe' },
            messages: { $push: '$messages.created' }
          }
        },
        // keep only the oldest message of each group and rename stuff
        // We keep only info about first & firstReply messages
        {
          $project: {
            id: '$_id.id',
            _id: 0,
            fromMe: '$_id.fromMe',
            created: { $arrayElemAt: ['$messages', 0] }
          }
        },
        // sort from oldest created
        {
          $sort: { created: 1 }
        },
        // group by threads
        // we have info about each thread
        {
          $group: {
            _id: '$id',
            messages: {
              $push: '$created'
            }
          }
        },
        // count replyTime = oldest reply created - oldest first message created
        // or replyTime is 0 when no reply
        // count replied === 1 when not responded (only oldest received message)
        // count replied === 2 when responded (both oldest received & sent
        // messages are present)
        {
          $project: {
            _id: 0,
            replied: { $size: '$messages' },
            replyTime: { $cond: [
              { $eq: [{ $size: '$messages' }, 2] },
              { $subtract: [
                { $arrayElemAt: ['$messages', 1] },
                { $arrayElemAt: ['$messages', 0] }
              ] },
              0
            ] },
            threadCreated: {
              $min: '$messages'
            }
          }
        },
        // group by `replied` (1 for notResponded, 2 for responded)
        // count average reply time of responded threads
        // count amount of responded & non-responded threads by user
        {
          $group: {
            _id: '$replied',
            replyTime: { $avg: '$replyTime' },
            count: { $sum: 1 },
            oldest: { $min: '$threadCreated' }
          }
        }
      ])
      .exec(done); // end of the query
      // returned array of 0-2 objects { id: (1| 2), replyTime: (0| ms), count:
      // number }
    },

    function (resp, done) {
      // the data about replied threads from query
      var repliedOutput = resp.find(function (elem) {
        return elem._id === 2;
      });
      // the data about notReplied threads from query
      var notRepliedOutput = resp.find(function (elem) {
        return elem._id === 1;
      });

      // fetch the reply-rate values from query data
      var replied = repliedOutput ? repliedOutput.count : 0;
      var notReplied = notRepliedOutput ? notRepliedOutput.count : 0;
      var replyTime = repliedOutput ? repliedOutput.replyTime : null;

      // creation of the oldest message
      var oldest;
      if (repliedOutput && notRepliedOutput) {
        oldest = repliedOutput.oldest < notRepliedOutput.oldest
          ? repliedOutput.oldest
          : notRepliedOutput.oldest;
      } else if (repliedOutput) {
        oldest = repliedOutput.oldest;
      } else if (notRepliedOutput) {
        oldest = notRepliedOutput.oldest;
      } else {
        oldest = null;
      }

      // return values
      return done(null, {
        replied: replied,
        notReplied: notReplied,
        replyTime: replyTime,
        oldest: oldest
      });
    }
  ], callback);
};

exports.updateUserReplyRate = function (userId, callback) {
  exports.readFromDatabase(new ObjectId(userId), function (err, result) {
    if (err) return callback(err);
    var processed = exports.processSimple(result);

    User.findByIdAndUpdate(new ObjectId(userId),
      {
        replyRate: processed.replyRate,
        replyTime: processed.replyTime,
        replyExpire: processed.replyExpire
      },
      {
        new: true,
        select: 'username _id replyRate replyTime replyExpire'
      },
      function (err, result) {
        if (err) return callback(err);
        if (result === null) return callback(new Error('User Not Found'));
        return callback(null, result.toObject());
      });
  });
};

exports.updateExpiredReplyRates = function (callback) {
  var cursor = User.find({
    $or: [
      { replyExpire: { $lt: new Date() } },
      { replyExpire: { $exists: false } }
    ]
  }, { select: '_id' }).cursor();


  // this is the test for async.doWhilst
  var keepGoing = true;
  var progress = 0;
  function testKeepGoing() {
    return keepGoing;
  }

  // the iteratee (function to run in each step) of async.doWhilst
  function processNext(cb) {

    // getting the next user from mongodb
    cursor.next(function (err, user) {
      // error
      if (err) return cb(err);
      // stream finished
      if (!user) {
        keepGoing = false;
        return cb();
      }

      // update
      exports.updateUserReplyRate(user._id, function (err) {
        if (err) cb(err);
        ++progress;
        return cb();
      });

    });
  }

  // callback for the end of the script
  function finish(err) {
    return callback(err, progress);
  }

  async.doWhilst(processNext, testKeepGoing, finish);
};

/**
 * @typedef {Object} ReplyData
 * @property {string} replyRate - Reply rate of user for display. Empty string
 * when no threads received by the user
 * @property {string} replyTime - Average reply time of user for display. Empty
 * string if no received threads replied
 */

/**
 * (synchronous)
 * process the data from exports.readFromDatabase to readable replyRate
 * and replyTime
 *
 * @param {Object} data
 * @param {number} data.replied - # of replied threads
 * @param {number} data.notReplied - # of not replied threads
 * @param {number|null} data.replyTime - average reply time
 * @returns {ReplyData} replyRate and replyTime for display
 */
exports.process = function (data) {
  return exports.display(exports.processSimple(data));
};

exports.display = function (data) {

  var replyRate = data.replyRate === null
    ? ''
    : Math.round(data.replyRate * 100) + '%';

  // length of a day in milliseconds
  var day = 24 * 3600 * 1000;
  var replyTime;

  // generate the approximate average replyTime described by words
  if (data.replyTime === null) { // not available
    replyTime = '';
  } else if (data.replyTime < day) { // less than a day
    replyTime = 'less than a day';
  } else if (data.replyTime < 7 * day) { // 1 - 7 days
    var dayCount = Math.round(data.replyTime / day);
    replyTime = dayCount + ' day' + (dayCount > 1 ? 's' : ''); // '# days'
  } else if (data.replyTime < 32 * day) { // 7 days - 1 month
    var weekCount = Math.round(data.replyTime / (7 * day));
    replyTime = weekCount + ' week' + (weekCount > 1 ? 's' : ''); // '# weeks'
  } else {
    replyTime = 'more than a month';
  }

  return {
    replyRate: replyRate,
    replyTime: replyTime
  };
};

exports.processSimple = function (data) {
  // replyRate in % or empty string when not countable
  var replyRate = data.replied + data.notReplied > 0
    ? data.replied / (data.replied + data.notReplied)
    : null;

  var replyTime = Math.round(data.replyTime);

  var replyExpire;

  var day = 24 * 3600 * 1000;

  if (data.oldest === null) {
    replyExpire = null;
  } else {
    // 180 days after the oldest message
    var oldest180d = data.oldest.getTime() + 180 * day;
    // 1 day after now
    var now1d = Date.now() + 1 * day;
    // later of both values (not to count this too often)
    replyExpire = new Date(Math.max(oldest180d, now1d));
  }

  return {
    replyRate: replyRate,
    replyTime: replyTime,
    replyExpire: replyExpire
  };
};

'use strict';

var async = require('async'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    moment = require('moment'),
    Message = mongoose.model('Message'),
    MessageStat = mongoose.model('MessageStat');

/**
 * Creates & saves a new MessageStat document
 */
function createMessageStat(message, done) {
  var messageStat = new MessageStat({
    firstMessageUserFrom: message.userFrom,
    firstMessageUserTo: message.userTo,
    firstMessageCreated: message.created,
    firstMessageLength: message.content.length
  });

  messageStat.save(function (err) {
    if (err) return done(err);
    return done(null, messageStat);
  });
}

/**
 * update the MessageStat document in database with information
 * about the first reply
 */
function addFirstReplyInfo (messageStat, message, done) {
  MessageStat.findOneAndUpdate({
    firstMessageUserFrom: message.userTo,
    firstMessageUserTo: message.userFrom,
    firstReplyCreated: null
  }, {
    $set: {
      firstReplyCreated: message.created,
      firstReplyLength: message.content.length,
      timeToFirstReply: message.created.getTime()
        - messageStat.firstMessageCreated.getTime()
    }
  })
  .exec(done);
}

/**
 * Provided a Message, this function will create or update the
 * MessageStat belonging to the Message provided
 */
exports.updateMessageStat = function (message, callback) {

  async.waterfall([

    // Get the MessageStat, we assume that only one MessageStat ever exists for
    // each pair of users.
    function (done) {
      MessageStat.findOne({
        $or: [
          {
            firstMessageUserFrom: message.userFrom,
            firstMessageUserTo: message.userTo
          },
          {
            firstMessageUserFrom: message.userTo,
            firstMessageUserTo: message.userFrom
          }
        ]
      }).exec(function (err, messageStat) {
        done(err, messageStat);
      });
    },

    // After searching for the MessageStat, next we take one of three actions:
    // - No MessageStat found, create a new one with the first message
    // - MessageStat found, no reply found, update the reply
    // - Both first and reply found, do nothing, move on
    function (messageStat, done) {
      // If the MessageStat does already exist:
      if (!!messageStat) {
        // Does this MessageStat have a first reply?
        if (!!messageStat.timeToFirstReply) {
          // Yes: Nothing to do, move on
          return done(null, 'other');
        } else {
          // No, so the MessageStat exists, but doesn't have a first reply, so
          // add the first reply now.
          findMessagesUpdateMessageStat(messageStat, done);
        }
      } else {
        // No MessageStat was found, let's create a new one
        findMessagesCreateMessageStat(done);
      }
    }

  ], function (err, response) {
    if (err) return callback(err);
    callback(null, response);
  });

  /*
   * This is a branch we follow when we found no MessageStat
   */
  function findMessagesCreateMessageStat(cb) {
    async.waterfall([
      // Find the first message between these two users
      function (done) {
        Message.findOne({
          $or: [
            {
              userFrom: message.userFrom,
              userTo: message.userTo
            },
            {
              userFrom: message.userTo,
              userTo: message.userFrom
            }
          ]
        })
        // Sort by the `created` field and limit to 1 to find the first message
        // sent or received between these two users
        .limit({ created: 1 })
        .exec(function (err, firstMessage) {
          return done(err, firstMessage);
        });
      },

      // Create the MessageStat filling only the first message part
      function (firstMessage, done) {
        if (firstMessage) {
          return createMessageStat(firstMessage, done);
        } else {
          return done(new Error('The Thread is Empty'));
        }
      },

      // Then do the same the search for firstReply from above
      // We do this because we can't be sure that this process has been run on
      // the first message between two users, so we check here if there is
      // already a reply to fill in the missing data if it exists.
      function (messageStat, done) {
        findMessagesUpdateMessageStat(messageStat, done);
      },

      function (response, done) {
        if (response === 'other') {
          response = 'first';
        }
        return done(null, response);
      }


    ], cb);
  }

  /*
   * This is a branch we follow when we found a MessageStat with empty
   * timeToFirstReply
   */
  function findMessagesUpdateMessageStat(messageStat, cb) {
    async.waterfall([
      function (done) {
        // Scan the list of messages to see if we find a firstReply
        // We do that by searching for the first message that was from the
        // recipient and to the sender, that will be the first reply.
        Message.findOne({
          userFrom: messageStat.firstMessageUserTo,
          userTo: messageStat.firstMessageUserFrom
        })
        // Sort by `created` and limit to 1 to get the first reply by time
        .limit({ created: 1 })
        .exec(function (err, firstReply) {
          return done(err, firstReply);
        });
      },

      function (firstReply, done) {
        // If we do:
        if (!!firstReply) {
          // Update the MessageStat with the timeToFirstReply etc
          addFirstReplyInfo(messageStat, firstReply, function (err) {
            if (err) return done(err);
            return done(null, 'firstReply');
          });
        } else {
          return done(null, 'other');
        }
      }
    ], cb);
  }
};

/**
 * provided userId and the timestamp to which we count the statistics,
 * the function will return reply rate and reply time of the user
 * { replyRate, replyTime }
 *
 * @param {object} userId - id of the user (mongoose ObjectId)
 * @param {number} timeNow - timestamp to which we count the statistics
 *
 * @TODO finish this JSDoc
 */
exports.readMessageStatsOfUser = function (userId, timeNow, callback) {
  var DAY = 24 * 3600 * 1000;

  async.waterfall([
    /**
     * Get the data from the database
     * get all MessageStat documents between timeNow and timeNow - 90 days
     */
    function (done) {
      MessageStat.find({
        firstMessageUserTo: userId,
        firstMessageCreated: {
          $lte: new Date(timeNow),
          $gt: new Date(timeNow - 90 * DAY)
        }
      })
      .sort({ firstMessageCreated: -1 })
      .exec(function (err, resp) {
        return done(err, resp);
      });
    },

    /**
     * Count the statistics
     */
    function (messageStats, done) {

      /**
       * Choose the MessageStats to use (as described above)
       * if we have less than 10 stats in last 90 days since timeNow,
       *    use all of them
       * if we have less than 10 stats in last 30 days but more in last 90 days,
       *    use last 10 stats
       * if we have more than 30 messages in last 30 days,
       *    use all from last 30 days
       */
      var chosenStats = (function (messageStats) {
        // less than 10 in 90 days
        if (messageStats.length < 10) {
          return messageStats;

        // 10th youngest messageStat is older than 30 days
        } else if (messageStats[9].firstMessageCreated.getTime() < timeNow - 30 * DAY) {
          return messageStats.splice(0, 10);

        // otherwise we use all the messageStats within 30 days
        } else {
          return messageStats.filter(function (stat) {
            return stat.firstMessageCreated.getTime() >= timeNow - 30 * DAY;
          });
        }
      }(messageStats));

      /* count the numbers for statistics
       * if we have no messageStats
       *    both replyRate and replyTime are null
       * if we have no replies
       *    replyRate is 0 and replyTime is null
       * otherwise
       *    replyRate is replied stats/all stats
       *    replyTime is average (mean) reply time of replied stats [milliseconds]
       */
      var stats = (function (chosenStats) {

        var repliedCount = 0, // amount of replies
            allCount = chosenStats.length, // amount of first messages received
            replyTimeCumulated = 0; // sum of the timeToFirstReply

        // Collect the data from chosenStats
        for (var i = 0, len = chosenStats.length; i < len; ++i) {
          var stat = chosenStats[i];
          if (typeof(stat.timeToFirstReply) === 'number') {
            ++repliedCount;
            replyTimeCumulated += stat.timeToFirstReply;
          }
        }

        var replyRate,
            replyTime;

        if (allCount === 0) {
          replyRate = null;
          replyTime = null;
        } else if (repliedCount === 0) {
          replyRate = 0;
          replyTime = null;
        } else {
          replyRate = repliedCount / allCount;
          replyTime = replyTimeCumulated / repliedCount;
        }

        return { replyRate: replyRate, replyTime: replyTime };

      }(chosenStats));

      return done(null, stats);
    }

  ], function (err, stats) {
    if (err) return callback(err);
    callback(null, stats);
  });
};

/**
 * Convert the { replyRate, replyTime } object returned from
 * exports.readMessageStatsOfUser into a human readable form (strings)
 * returns { replyRate: '..%', replyTime: '.. (minutes|hours|days|months)' }
 * synchronous
 *
 * @param {Object} stats
 * @param {number|null} stats.replyRate
 * @param {number|null} stats.replyTime
 * @returns {Object}
 */
exports.formatStats = function (stats) {
  var replyRate = (_.isFinite(stats.replyRate))
    ? Math.round(stats.replyRate * 100) + '%'
    : '';

  var replyTime = (_.isFinite(stats.replyTime))
    ? moment.duration(stats.replyTime).humanize()
    : '';

  return { replyRate: replyRate, replyTime: replyTime };
};

exports.readFormattedMessageStatsOfUser = function (userId, timeNow, callback) {
  async.waterfall([

    // read message stats
    function (done) {
      exports.readMessageStatsOfUser(userId, timeNow, done);
    },

    // format message stats (this one is synchronous)
    function (stats, done) {
      var formatted = exports.formatStats(stats);
      return done(null, formatted);
    }
  ], callback);
};

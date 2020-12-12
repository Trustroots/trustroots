const async = require('async');
const mongoose = require('mongoose');
const _ = require('lodash');
const moment = require('moment');
const Message = mongoose.model('Message');
const MessageStat = mongoose.model('MessageStat');

/**
 * Creates & saves a new MessageStat document
 */
function createMessageStat(message, done) {
  const messageStat = new MessageStat({
    firstMessageUserFrom: message.userFrom,
    firstMessageUserTo: message.userTo,
    firstMessageCreated: message.created,
    firstMessageLength: message.content.length,
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
function addFirstReplyInfo(messageStat, message, done) {
  MessageStat.findOneAndUpdate(
    {
      firstMessageUserFrom: message.userTo,
      firstMessageUserTo: message.userFrom,
      firstReplyCreated: null,
    },
    {
      $set: {
        firstReplyCreated: message.created,
        firstReplyLength: message.content.length,
        timeToFirstReply:
          message.created.getTime() - messageStat.firstMessageCreated.getTime(),
      },
    },
  ).exec(done);
}

/**
 * @callback updateStatCb
 *
 * @param {Error} err
 * @param {String} response - ['first', 'firstReply', 'other']
 *
 */

/**
 * Provided a Message, this function will create or update the
 * MessageStat belonging to the Message provided
 *
 * @param {Object} message
 * @param {ObjectId} message.userFrom
 * @param {ObjectId} message.userTo
 * @param {updateStatCb} callback
 */
exports.updateMessageStat = function (message, callback) {
  async.waterfall(
    [
      // Get the MessageStat, we assume that only one MessageStat ever exists for
      // each pair of users.
      function (done) {
        MessageStat.findOne({
          $or: [
            {
              firstMessageUserFrom: message.userFrom,
              firstMessageUserTo: message.userTo,
            },
            {
              firstMessageUserFrom: message.userTo,
              firstMessageUserTo: message.userFrom,
            },
          ],
        }).exec(function (err, messageStat) {
          done(err, messageStat);
        });
      },

      // After searching for the MessageStat, next we take one of three actions:
      // - No MessageStat found, create a new one with the first message
      // - MessageStat found, no reply information saved, update the reply
      // - Both first and reply information already saved, do nothing, move on
      function (messageStat, done) {
        // If the MessageStat does already exist:
        if (messageStat) {
          // Does this MessageStat have a first reply?
          if (messageStat.timeToFirstReply) {
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
      },
    ],
    function (err, response) {
      if (err) return callback(err);
      callback(null, response);
    },
  );

  /*
   * This is a branch we follow when we found no MessageStat
   */
  function findMessagesCreateMessageStat(cb) {
    async.waterfall(
      [
        // Find the first message between these two users
        function (done) {
          Message.findOne({
            $or: [
              {
                userFrom: message.userFrom,
                userTo: message.userTo,
              },
              {
                userFrom: message.userTo,
                userTo: message.userFrom,
              },
            ],
          })
            // Sort by the `created` field to find the first message
            // sent or received between these two users
            .sort({ created: 1 })
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

        // Then do the same search for the firstReply from above
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
        },
      ],
      cb,
    );
  }

  /*
   * This is a branch we follow when we found a MessageStat with empty
   * timeToFirstReply
   */
  function findMessagesUpdateMessageStat(messageStat, cb) {
    async.waterfall(
      [
        function (done) {
          // Scan the list of messages to see if we find a firstReply
          // We do that by searching for the first message that was from the
          // recipient and to the sender, that will be the first reply.
          Message.findOne({
            userFrom: messageStat.firstMessageUserTo,
            userTo: messageStat.firstMessageUserFrom,
          })
            // Sort by `created` to get the *first* reply
            .sort({ created: 1 })
            .exec(function (err, firstReply) {
              return done(err, firstReply);
            });
        },

        function (firstReply, done) {
          // If we do:
          if (firstReply) {
            // Update the MessageStat with the timeToFirstReply etc
            addFirstReplyInfo(messageStat, firstReply, function (err) {
              if (err) return done(err);
              return done(null, 'firstReply');
            });
          } else {
            return done(null, 'other');
          }
        },
      ],
      cb,
    );
  }
};

/**
 * @callback readStatsCb
 *
 * @param {Error} err
 * @param {Object} stats
 * @param {?number} stats.replyRate - the reply rate of the user.
 *    Equals null when no messageStats found, otherwise number from interval
 *    [0, 1] (replied/all)
 * @param {?number} stats.replyTime - the average number of milliseconds
 *    between the first message was sent and the first reply was sent.
 *    Equals null when stats.replyRate is null or 0. Otherwise number.
 */

/**
 * provided userId and the timestamp to which we count the statistics,
 * the function will return reply rate and reply time of the user
 * { replyRate, replyTime }
 *
 * @param {ObjectId} userId - id of the user (mongoose ObjectId)
 * @param {number} timeNow - timestamp to which we count the statistics
 * @param {readStatsCb} callback
 */
exports.readMessageStatsOfUser = function (userId, timeNow, callback) {
  const DAY = 24 * 3600 * 1000;

  async.waterfall(
    [
      /**
       * Get the data from the database
       * get all MessageStat documents between timeNow and timeNow - 90 days
       */
      function (done) {
        MessageStat.find({
          firstMessageUserTo: userId,
          firstMessageCreated: {
            $lte: new Date(timeNow),
            $gt: new Date(timeNow - 90 * DAY),
          },
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
         * if we have more than 10 messages in last 30 days,
         *    use all from last 30 days
         */
        const chosenStats = (function (messageStats) {
          // less than 10 in 90 days
          if (messageStats.length < 10) {
            return messageStats;

            // 10th youngest messageStat is older than 30 days
          } else if (
            messageStats[9].firstMessageCreated.getTime() <
            timeNow - 30 * DAY
          ) {
            return messageStats.splice(0, 10);

            // otherwise we use all the messageStats within 30 days
          } else {
            return messageStats.filter(function (stat) {
              return stat.firstMessageCreated.getTime() >= timeNow - 30 * DAY;
            });
          }
        })(messageStats);

        /* count the numbers for statistics
         * if we have no messageStats
         *    both replyRate and replyTime are null
         * if we have no replies
         *    replyRate is 0 and replyTime is null
         * otherwise
         *    replyRate is replied stats/all stats
         *    replyTime is average (mean) reply time of replied stats [milliseconds]
         */
        const stats = (function (chosenStats) {
          let repliedCount = 0; // amount of replies
          const allCount = chosenStats.length; // amount of first messages received
          let replyTimeCumulated = 0; // sum of the timeToFirstReply

          // Collect the data from chosenStats
          for (let i = 0, len = chosenStats.length; i < len; ++i) {
            const stat = chosenStats[i];
            if (typeof stat.timeToFirstReply === 'number') {
              ++repliedCount;
              replyTimeCumulated += stat.timeToFirstReply;
            }
          }

          // count the replyRate and average replyTime from the chosen stats
          let replyRate;
          let replyTime;

          // no message stats
          if (allCount === 0) {
            replyRate = null;
            replyTime = null;
            // no replied stats
          } else if (repliedCount === 0) {
            replyRate = 0;
            replyTime = null;
            // some replied stats
          } else {
            replyRate = repliedCount / allCount;
            replyTime = replyTimeCumulated / repliedCount;
          }

          return { replyRate, replyTime };
        })(chosenStats);

        return done(null, stats);
      },
    ],
    function (err, stats) {
      if (err) return callback(err);
      callback(null, stats);
    },
  );
};

/**
 * A human readable form of reply statistics
 * @typedef {Object} formattedStats
 * @property {string} replyRate - % i.e. '43%', or empty string
 * @property {string} replyTime - average replyTime in human readable form
 *    number of seconds, minutes, hours, days, months or empty string
 *    For the conversion see moment.duration().humanize() of momentjs library
 */

/**
 * Convert the { replyRate, replyTime } object returned from
 * exports.readMessageStatsOfUser into a human readable form (strings)
 * synchronous
 *
 * @param {Object} stats
 * @param {?number} stats.replyRate
 * @param {?number} stats.replyTime
 * @returns {Object}
 */
exports.formatStats = function (stats) {
  // if reply rate is a well-behaved number, we convert the fraction to %
  const replyRate = _.isFinite(stats.replyRate)
    ? Math.round(stats.replyRate * 100) + '%'
    : '';

  // if replyTime is a well-behaved number, we convert the milliseconds to
  // a human readable string
  const replyTime = _.isFinite(stats.replyTime)
    ? moment.duration(stats.replyTime).humanize()
    : '';

  return { replyRate, replyTime };
};

/**
 * @callback readFormattedStatsCb
 *
 * @param {Error} err
 * @param {formattedStats} stats
 */

/**
 * bring together readMessageStatsOfUser and formatStats functions
 *
 * @param {ObjectId} userId - id of the user (mongoose ObjectId)
 * @param {number} timeNow - timestamp to which we count the statistics
 * @param {readFormattedStatsCb} callback
 */
exports.readFormattedMessageStatsOfUser = function (userId, timeNow, callback) {
  async.waterfall(
    [
      // read message stats
      function (done) {
        exports.readMessageStatsOfUser(userId, timeNow, done);
      },

      // format message stats (this one is synchronous)
      function (stats, done) {
        const formatted = exports.formatStats(stats);
        return done(null, formatted);
      },
    ],
    callback,
  );
};

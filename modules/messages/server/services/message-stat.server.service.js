'use strict';

var async = require('async'),
    mongoose = require('mongoose'),
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
 * update the MessageStat with a first reply information
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

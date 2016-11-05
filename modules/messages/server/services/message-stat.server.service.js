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

    // Get the MessageStat
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

    function (messageStat, done) {
      // If the MessageStat does already exist:
      if (!!messageStat) {
        // Does it have a timeToFirstReply?
        if (!!messageStat.timeToFirstReply) {
          // Yes: Nothing to do, move on
          return done(null, 'other');
        } else {
          // No:
          findMessagesUpdateMessageStat(messageStat, done);
        }
      } else {
        // If it does not exist:
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
      // Find the first message
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
        .limit({ created: 1 })
        .exec(function (err, firstMessage) {
          return done(err, firstMessage);
        });
      },

      // Create the MessageStat
      function (firstMessage, done) {
        if (firstMessage) {
          return createMessageStat(firstMessage, done);
        } else {
          return done(new Error('The Thread is Empty'));
        }
      },

      // Then do the same the search for firstReply from above
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
        Message.findOne({
          userFrom: messageStat.firstMessageUserTo,
          userTo: messageStat.firstMessageUserFrom
        })
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

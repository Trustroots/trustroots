'use strict';
/**
 * Module dependencies.
 */
var path = require('path'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    mongoose = require('mongoose'),
    influxService = require(path.resolve('./modules/core/server/services/influx.server.service')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller'));

// eslint complained here about unused variable => requiring without assignment
require(path.resolve('./modules/messages/server/models/message.server.model'));


var Message = mongoose.model('Message');


/**
 * This is a callback for the asynchronous influx modules
 *
 * @callback influxCallback
 * @param {error} error
 * @param {string} response
 */

/**
 * this module gets some statistical information for message from database
 * and sends the data to influxService to add to influxdb
 * @param {Object} message - a message object (as returned by mongoDB)
 * @returns {influxCallback} callback - a callback that handles the response
 */
module.exports = function (message, callback) {
  // some variables used later, filled inside waterfall
  var isFirstMessage,
      isFirstReply;

  // fixing some strange filling of message data
  // (userFrom is not id but user object)
  var userFrom = message.userFrom._id
    ? message.userFrom._id
    : message.userFrom;
  var userTo = message.userTo._id
    ? message.userTo._id
    : message.userTo;

  async.waterfall([
    function readFirstMessage(done) {
      // find the oldest message of the thread
      return Message.findOne({
        $or: [
          {
            userTo: userTo,
            userFrom: userFrom
          },
          {
            userTo: userFrom,
            userFrom: userTo
          }
        ]
      })
      .sort({ created: 1 })
      .exec(done);
    },

    function readFirstReply(firstMessage, done) {
      // if no message was found, throw error (there is always the first message
      // already (at least the one just saved))
      if (!firstMessage) {
        var err = new Error('first message not found, but should have been already saved');
        done(err);
      }

      // is the new message the first message of the thread?
      isFirstMessage = !!(String(firstMessage._id) === String(message._id));

      // can the message be the actual first reply?
      // - is it not the firstMessage?
      // is the sender and receiver in different order than in the firstMessage?
      var canBeTheFirstReply = !isFirstMessage && String(firstMessage.userTo) === String(userFrom);
      // if this can be the oldest reply, find the oldest reply of the thread
      if (canBeTheFirstReply) {
        return Message.findOne({
          userTo: firstMessage.userFrom,
          userFrom: firstMessage.userTo
        })
        .sort({ created: 1 })
        .exec(function (err, firstReply) {
          return done(err, firstMessage, firstReply);
        });
      } else {
        return done(null, firstMessage, null);
      }
    },

    function sendDataToInflux(firstMessage, firstReply, done) {
      // is the new message the first reply of the thread?
      isFirstReply = !!(firstReply && String(firstReply._id) === String(message._id));

      // count the reply time for statistics (miliseconds)
      var replyTime;
      if (isFirstReply) {
        replyTime = firstReply.created.getTime() - firstMessage.created.getTime();
      }

      // count length of the message
      // excluding html tags and multiple whitespace characters
      var msgLen = textProcessor.plainText(message.content, true).length;


      // message position in the thread
      var position;
      if (isFirstMessage) {
        position = 'first';
      } else if (isFirstReply) {
        position = 'first_reply';
      } else {
        position = 'normal';
      }


      var msgLenType = msgLen < config.longMessageMinimumLength ? 'short' : 'long';

      // values for influxdb, using camelCase for tag and field keys
      var values = {
        messageId: String(message._id), // id of message, (discussed keeping for now)
        idFrom: String(userFrom), // id of sender
        idTo: String(userTo), // id of receiver
        msgLength: msgLen, // length of the content
        replyTime: isFirstReply ? replyTime : -1, // reply time when first response only
        time: message.created.getTime() // creation timestamp (milliseconds)
      };

      // tags for influxdb
      var tags = {
        position: position, // position (first, first_reply, normal)
        msgLengthType: msgLenType // (short, long) content (shortness defined in a config
      };

      // sending the data to influxdb via the service
      return influxService.writePoint('messageSent', values, tags,
        function (err, result) {
          return done(err, result);
        });
    }
  ], function (err, result) {
    if (err) {
      console.error(err);
    }
    if (typeof(callback) === 'function') {
      return callback(err, result);
    }
  });

  return;
};

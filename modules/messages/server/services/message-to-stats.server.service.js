'use strict';
/**
 * Module dependencies.
 */
var path = require('path'),
    _ = require('lodash'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    mongoose = require('mongoose'),
    statService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
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
 * this function is a shortcut for processing and sending the data to
 * influxService (which sends it to influxdb)
 * @param {object} message - a message object (as returned by mongoDB)
 * @param {influxCallback} callback - a callback that handles the response
 */
module.exports.save = function (message, callback) {
  async.waterfall([
    // Check whether the influxDB is enabled. Be lazy and quit if disabled.
    function (done) {
      var isInfluxEnabled = _.get(config, 'influxdb.enabled');
      if (isInfluxEnabled !== true) {
        return done(new Error('influxDB is disabled'));
      }
      return done();
    },

    // Process the message provided
    function (done) {
      module.exports.process(message, function (err, fields, tags) {
        return done(err, fields, tags);
      });
    },

    // Send the message provided to influxService
    function (fields, tags, done) {
      module.exports.send(fields, tags, function (err, response) {
        return done(err, response);
      });
    }
  ], function (err, response) {
    if (err && (process.env.NODE_ENV === 'production')) {
      console.error(err);
    }
    if (typeof callback === 'function') {
      return callback(err, response);
    }
  });
};

/**
 * This is a callback for the exports.process
 *
 * @callback processMessageCallback
 * @param {error} error
 * @param {object} fields - object of field keys and values as they'll be saved
 * in influx
 * @param {object} tags - object of tag keys and values as they'll be saved in
 * influx
 */

/**
 * this function gets some info about the message sent and then calls the callback
 * with field and tag keys and values as they're expected in database
 * @param {object} message - a message object as returned by mongoDB
 * @param {processMessageCallback} callback
 */
module.exports.process = function (message, callback) {
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
        return done(err);
      }


      // is the new message the first message of the thread?
      isFirstMessage = String(firstMessage._id) === String(message._id);

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

    function prepareData(firstMessage, firstReply, done) {
      // is the new message the first reply of the thread?
      isFirstReply = Boolean(firstReply && String(firstReply._id) === String(message._id));

      // count the reply time for statistics (milliseconds)
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
        position = 'firstReply';
      } else {
        position = 'other';
      }

      var msgLenType = msgLen < config.limits.longMessageMinimumLength ? 'short' : 'long';

      // values for stats
      var statObject = {
        namespace: 'messages',
        counts: {
          sent: 1
        },
        values: {},
        tags: {
          position: position, // position (first|firstReply|other)
          messageLengthType: msgLenType // (short|long) content (shortness defined in a config)
        },
        meta: {
          messageId: String(message._id),
          userFrom: String(userFrom), // id of sender
          userTo: String(userTo), // id of receiver
          messageLength: msgLen // length of the content
        },
        time: message.created
      };

      // we measure the reply time only for the first replies (time since the
      // first message sent by the other user)
      if (isFirstReply) {
        statObject.values.timeToFirstReply = replyTime;
      }

      return done(null, statObject);
    }
  ], callback);
};

/**
 * this function sends the processed field tags and values to statService
 * @param {object} fields - object of field keys and values as expected by
 * influxService & influxdb
 * @param {object} tags - object of tag keys and values as expected by
 * influxService & influxdb
 * @param {influxCallback} callback - a callback that handles the response
 */
module.exports.send = function (statObject, callback) {

  return statService.stat(statObject, callback);
};

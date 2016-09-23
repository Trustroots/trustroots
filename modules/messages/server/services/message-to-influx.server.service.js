'use strict';
/**
 * Module dependencies.
 */
var co = require('co'),
    path = require('path'),
    influxService = require(path.resolve('./modules/core/server/services/influx.server.service')),
    config = require(path.resolve('./config/config')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller'));


/**
 * this module gets some statistical information for message from database
 * and sends the data to influxService to add to influxdb
 * @param {Object} message - a message returned from database (created or read)
 * @param {Object} User - mongoose Model object (dependency)
 * @param {Object} Message - mongoose Model object (dependency)
 * @param {Object} influxService - a module with method writePoint() writes
 * point to influxdb (dependency)
 * @returns {Promise} - promise to be resolved with influxdb response or
 * rejected with an error
 */
module.exports = function (message, { Message: Message }) {

  return co(function * () {
    // some variables used later, filled in inner scopes
    let isFirstMessage,
        isFirstReply,
        replyTime,
        msgLen;
    let firstMessage,
        firstReply;

    // fixing some strange filling of message data
    // (userFrom is not id but user object)
    let userFrom = message.userFrom._id
      ? message.userFrom._id
      : message.userFrom;
    let userTo = message.userTo._id
      ? message.userTo._id
      : message.userTo;

    // find the oldest message of the thread
    firstMessage = yield Message.findOne({
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
    .sort({ created: 1 });

    // is the new message the first message of the thread?
    isFirstMessage = !!(String(firstMessage._id) === String(message._id));

    var canBeTheFirstReply = !isFirstMessage && String(firstMessage.userTo) === String(userFrom);
    if (canBeTheFirstReply) {
      // if this can be the oldest reply, find the oldest reply of the thread
      firstReply = yield Message.findOne({
        userTo: firstMessage.userFrom,
        userFrom: firstMessage.userTo
      })
      .sort({ created: 1 });
    }

    // is the new message the first reply of the thread?
    isFirstReply = !!(firstReply && String(firstReply._id) === String(message._id));

    // count the reply time for statistics (miliseconds)
    if (isFirstReply) {
      replyTime = firstReply.created.getTime() - firstMessage.created.getTime();
    }

    // count length of the message
    // excluding html tags and multiple whitespace characters
    msgLen = textProcessor.plainText(message.content, true).length;


    // message position in the thread
    let position;
    if (isFirstMessage) {
      position = 'first';
    } else if (isFirstReply) {
      position = 'first_reply';
    } else {
      position = 'normal';
    }


    let msgLenType = msgLen < config.longMessageMinimumLength ? 'short' : 'long';

    // TODO figure out whether to use cammelCase or underscore_names
    // values for influxdb
    let values = {
      id_message: String(message._id), // id of message
      id_from: String(userFrom), // id of sender
      id_to: String(userTo), // id of receiver
      msg_length: msgLen, // length of the content
      reply_time: isFirstReply ? replyTime : -1, // reply time when first response only
      time: message.created.getTime() // creation timestamp (milliseconds)
    };

    // tags for influxdb
    let tags = {
      position: position, // position (first, first_reply, normal)
      msg_length_type: msgLenType // (short, long) content (shortness defined in MIN_LONG_MESSAGE_LENGTH)
    };

    let response = yield new Promise(function (resolve, reject) {
      influxService.writePoint('messages_sent', values, tags,
        function (err, response) {
          if (err) return reject(err);
          return resolve(response);
        }
      );
    });

    return response;
  })
    .catch(function (e) {
      console.error(e);
      throw e;
    });
};

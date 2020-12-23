// This service takes care of fetching and sending message statistics to stats api.
// It is mainly used in message controller: A new statistics point is created
// after a new message is sent.

/**
 * Module dependencies.
 */
const path = require('path');
const _ = require('lodash');
const async = require('async');
const config = require(path.resolve('./config/config'));
const mongoose = require('mongoose');
const log = require(path.resolve('./config/lib/logger'));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));

require(path.resolve('./modules/messages/server/models/message.server.model'));

const Message = mongoose.model('Message');

/**
 * The object which stats api .stat method expects as parameter
 * @typedef {Object} StatObject
 * @property {string} namespace - the name, identifier of the stat point
 * @property {Object} [counts] - object of a shape { <count1>: number, ... }
 * We care about a sum of the numbers in statistics. At least one of counts or values must be provided.
 * @property {Object} [values] - object of a shape { <value1>: number, ... }
 * We care about an average of the numbers in statistics. At least one of counts or values must be provided.
 * @property {Object} [tags] - object of a shape { <tag1>: string|number, ... }
 * Tags separate stat points into subsets based on a limited amount of tag values
 * There should be limited amount of tags with limited amount of possible values
 * @property {Object} [meta] - object of a shape { <meta1>: string| number, ... }
 * Meta contains non-essential data, which will be saved only to some stat services
 * Meta will be saved into influx, not into stathat.
 * All string values which are not tags should go to meta.
 * @property {Date} [time] - time of the point if it is specified
 *
 * {
 *   namespace: 'testStat',
 *   counts: {
 *     count1: 1,
 *     count2: 3
 *   },
 *   values: {
 *     value1: 3.51,
 *     value2: 7.24
 *   },
 *   tags: {
 *     tag1: 'value1',
 *     tag2: 'value2'
 *   },
 *   meta: {
 *     meta1: 'value1',
 *     meta2: 12.5
 *   },
 *   time: new Date('1999-09-09 9:09:09.999')
 * }
 */

/**
 * This is a callback for the asynchronous influx modules
 * @callback statsCallback
 * @param {error} error
 */

/**
 * This function is a wrapper for processing a message's statistics and
 * sending the data to Stats api.
 * @param {object} message - a message object (as returned by mongoDB)
 * @param {statsCallback} callback - a callback that handles the response
 */
module.exports.save = function (message, callback) {
  async.waterfall(
    [
      // Check whether at least one of statistics services (influxdb, stathat)
      // is enabled.
      // Quit if all are disabled. The further computation is not necessary.
      function (done) {
        const areSomeStatsEnabled =
          _.get(config, 'influxdb.enabled') || _.get(config, 'stathat.enabled');
        if (areSomeStatsEnabled !== true) {
          return done(
            new Error(
              'All stat services are disabled. Not creating a point for message statistics.',
            ),
          );
        }
        return done();
      },

      // Process the message provided
      function (done) {
        module.exports.process(message, function (err, statObject) {
          return done(err, statObject);
        });
      },

      // Send the message provided to influxService
      function (statObject, done) {
        module.exports.send(statObject, function (err) {
          return done(err);
        });
      },
    ],
    function (err) {
      if (err) {
        log('error', 'Saving message stats failed.', err);
      }
      if (typeof callback === 'function') {
        return callback(err);
      }
    },
  );
};

/**
 * @callback processMessageCallback
 * @param {error} error
 * @param {StatObject} statObject - data object to be sent to Stats API
 */

/**
 * The function collects data about the message provided and formats it to StatObject ready for Stats API
 * @param {object} message - a message object as returned by mongoDB
 * @param {processMessageCallback} callback
 */
module.exports.process = function (message, callback) {
  // declare some variables needed in multiple scopes of async.waterfall
  let isFirstMessage;
  let isFirstReply;

  // fixing some strange filling of message data
  // (userFrom is not id but user object)
  const userFrom = message.userFrom._id
    ? message.userFrom._id
    : message.userFrom;
  const userTo = message.userTo._id ? message.userTo._id : message.userTo;

  async.waterfall(
    [
      function readFirstMessage(done) {
        // find the oldest message of the thread
        return Message.findOne({
          $or: [
            {
              userTo,
              userFrom,
            },
            {
              userTo: userFrom,
              userFrom: userTo,
            },
          ],
        })
          .sort({ created: 1 })
          .exec(done);
      },

      function readFirstReply(firstMessage, done) {
        // if no message was found, throw error (there is always the first message
        // already (at least the one just saved))
        if (!firstMessage) {
          const err = new Error(
            'first message not found, but should have been already saved',
          );
          return done(err);
        }

        // is the new message the first message of the thread?
        isFirstMessage = String(firstMessage._id) === String(message._id);

        // can the message be the actual first reply?
        // - is it not the firstMessage?
        // is the sender and receiver in different order than in the firstMessage?
        const canBeTheFirstReply =
          !isFirstMessage && String(firstMessage.userTo) === String(userFrom);
        // if this can be the oldest reply, find the oldest reply of the thread
        if (canBeTheFirstReply) {
          return Message.findOne({
            userTo: firstMessage.userFrom,
            userFrom: firstMessage.userTo,
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
        isFirstReply = Boolean(
          firstReply && String(firstReply._id) === String(message._id),
        );

        // count the reply time for statistics (milliseconds)
        let replyTime;
        if (isFirstReply) {
          replyTime =
            firstReply.created.getTime() - firstMessage.created.getTime();
        }

        // count length of the message
        // excluding html tags and multiple whitespace characters
        const msgLen = textService.plainText(message.content, true).length;

        // message position in the thread
        let position;
        if (isFirstMessage) {
          position = 'first';
        } else if (isFirstReply) {
          position = 'firstReply';
        } else {
          position = 'other';
        }

        const msgLenType =
          msgLen < config.limits.longMessageMinimumLength ? 'short' : 'long';

        // values for stats
        const statObject = {
          namespace: 'messages',
          counts: {
            sent: 1,
          },
          values: {},
          tags: {
            position, // position (first|firstReply|other)
            messageLengthType: msgLenType, // (short|long) content (shortness defined in a config)
          },
          meta: {
            messageId: String(message._id),
            userFrom: String(userFrom), // id of sender
            userTo: String(userTo), // id of receiver
            messageLength: msgLen, // length of the content
          },
          time: message.created,
        };

        // we measure the reply time only for the first replies (time since the
        // first message sent by the other user)
        if (isFirstReply) {
          statObject.values.timeToFirstReply = replyTime;
        }

        return done(null, statObject);
      },
    ],
    callback,
  );
};

/**
 * this function sends the processed field tags and values to statService
 * @param {StatObject} statObject - data object to be sent to Stats API
 * @param {statsCallback} callback - a callback that handles the response
 */
module.exports.send = function (statObject, callback) {
  return statService.stat(statObject, callback);
};

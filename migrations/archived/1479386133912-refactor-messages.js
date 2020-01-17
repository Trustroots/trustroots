/**
 * Refactors message schema (mongoose) to be able to send multiple notifications
 * about unread messages.
 * Removes `notified: boolean`, adds `notificationCount: number`
 *
 * notified: false => notificationCount: 0
 * notified: true => notificationCount: <amount of configured notifications (2)>
 *
 * notifications configured in config/env/default.js.limits.unreadMessageReminders
 */

const path = require('path');
const async = require('async');
const mongooseService = require(path.resolve('./config/lib/mongoose'));
const mongoose = require('mongoose');
const chalk = require('chalk');
const config = require(path.resolve('./config/config'));
// eslint-disable-next-line no-unused-vars
const messageModels = require(path.resolve('./modules/messages/server/models/message.server.model'));
const Message = mongoose.model('Message');

// define Promises for mongoose
// using native nodejs ES6 Promise here
mongoose.Promise = Promise;

const maxNotifications = config.limits.unreadMessageReminders.length;

exports.up = function (next) {


  async.waterfall([

    // Bootstrap db connection
    function (done) {
      mongooseService.connect(function () {
        console.log(chalk.green('Connected to MongoDB.'));
        done();
      });
    },

    // update the notified messages
    processMessages.bind(this, true),

    // update the un-notified messages
    processMessages.bind(this, false),

  ], function (err) {
    if (err) {
      console.error(err);
    }
    // Disconnect before exiting
    mongooseService.disconnect(function (mongooseErr) {
      if (mongooseErr) {
        console.error(mongooseErr);
      }
      next();
    });
  });

};


exports.down = function (next) {

  next();

};

/**
 * Finds messages in database and updates them to the new schema
 * Replaces notified: boolean with notificationCount: number
 *
 * @param {Boolean} processNotified - process notified (true) or unnotified (false) messages
 * @param {Function} callback - node style callback function
 */
function processMessages(processNotified, callback) {

  // log either 'notified' or 'un-notified'
  // define the prefix here
  const un = (processNotified) ? '' : 'un-';

  async.waterfall([

    // Count all (un)notified message documents
    function (done) {
      Message.count({ notified: processNotified }, function (err, total) {
        if (err) return done(err);

        const logMessage = (total > 0)
          ? 'Found ' + total + ' ' + un + 'notified messages to process.'
          : 'No ' + un + 'notified messages to process';

        console.log(logMessage);

        return done(null, total);
      });
    },

    // Get all (un)notified message documents one by one and update them
    function (total, done) {

      // count the successfully updated messages
      let counter = 0;

      // find all the (un)notified messages
      // http://mongoosejs.com/docs/api.html#querycursor-js
      const cursor = Message.find({ notified: processNotified }).cursor();

      // update each message one by one
      // http://mongoosejs.com/docs/api.html#querycursor_QueryCursor-eachAsync
      cursor.eachAsync(function (message) {
        // Update the message, return a promise (that's what eachAsync expects)
        // notified: true => notificationCount: 2
        // notified: false => notificationCount: 0
        return message.update(
          {
            $set: {
              notificationCount: (processNotified) ? maxNotifications : 0,
            },
            $unset: {
              notified: '',
            },
          },
          {
            // Mongoose will only update fields defined in the schema.
            // However, you can override that default behavior by
            // including the `strict:false` option
            strict: false,
            // Limits updates only to one document per update
            multi: false,
          })
          .exec()
          .then(function (raw) {
            // Succesfully saved this message
            if (raw.nModified === 1) {
              counter++;
            }
          });
      }, function (err) {

        // All done
        console.log('Processed ' + counter + ' of ' + total + ' ' + un + 'notified messages.');
        // close the cursor
        cursor.close(function (closingErr) {
          return done(closingErr || err || null);
        });
      });
    },
  ], callback);
}

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

const mongooseService = require('./../../config/lib/mongoose.mjs');
const mongoose = require('mongoose');
const config = require('./../../config/config.mts');
// eslint-disable-next-line no-unused-vars
const messageModels = require('./../../modules/messages/server/models/message.server.model.mjs');
const Message = mongoose.model('Message');

// define Promises for mongoose
// using native nodejs ES6 Promise here
mongoose.Promise = Promise;

const maxNotifications = config.limits.unreadMessageReminders.length;

exports.up = function (next) {

  migrateUp()
    .catch(function (err) {
      console.error(err);
    })
    .then(function () {
      // Disconnect before exiting
      mongooseService.disconnect(function (mongooseErr) {
        if (mongooseErr) {
          console.error(mongooseErr);
        }
        next();
      });
    });

};

async function migrateUp() {

  // Bootstrap db connection
  await new Promise(function (resolve) {
    mongooseService.connect(function () {
      console.log('Connected to MongoDB.');
      resolve();
    });
  });

  // update the notified messages
  await processMessages(true);

  // update the un-notified messages
  await processMessages(false);

}


exports.down = function (next) {

  next();

};

/**
 * Finds messages in database and updates them to the new schema
 * Replaces notified: boolean with notificationCount: number
 *
 * @param {Boolean} processNotified - process notified (true) or unnotified (false) messages
 */
async function processMessages(processNotified) {

  // log either 'notified' or 'un-notified'
  // define the prefix here
  const un = (processNotified) ? '' : 'un-';

  // Count all (un)notified message documents
  const total = await new Promise(function (resolve, reject) {
    Message.count({ notified: processNotified }, function (err, total) {
      if (err) return reject(err);
      resolve(total);
    });
  });

  const logMessage = (total > 0)
    ? 'Found ' + total + ' ' + un + 'notified messages to process.'
    : 'No ' + un + 'notified messages to process';

  console.log(logMessage);

  // Get all (un)notified message documents one by one and update them

  // count the successfully updated messages
  let counter = 0;

  // find all the (un)notified messages
  // http://mongoosejs.com/docs/api.html#querycursor-js
  const cursor = Message.find({ notified: processNotified }).cursor();

  await new Promise(function (resolve, reject) {
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
        const error = closingErr || err;
        if (error) return reject(error);
        resolve();
      });
    });
  });
}

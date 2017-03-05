'use strict';

/**
 * Refactors ...
 *
 * `notificationSent`
 * `notificationCount`
 */

var path = require('path'),
    async = require('async'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    mongoose = require('mongoose'),
    chalk = require('chalk'),
    // eslint-disable-next-line no-unused-vars
    messageModels = require(path.resolve('./modules/messages/server/models/message.server.model')),
    Message = mongoose.model('Message');

exports.up = function(next) {

  async.waterfall([

    // Bootstrap db connection
    function(done) {
      mongooseService.connect(function() {
        console.log(chalk.green('Connected to MongoDB.'));
        done();
      });
    },

    // Get all notified message documents
    function(done) {
      Message
        .find({
          notified: true,
          notificationSent: { $exists: false }
        })
        .exec(function (err, messages) {
          if (messages) {
            console.log('Found ' + messages.length + ' notified messages to process.');
          }
          done(err, messages);
        });
    },

    // Update each notified message document
    function(messages, done) {

      // No messages to process
      if (!messages.length) {
        console.log('No notified messages to process');
        return done();
      }

      // Count how many messages we've processed
      var counter = 0;

      // `mapSeries` runs only a single async operation at a time
      async.mapSeries(
        messages,
        // Iterate each message using this function
        // Must call `messageDone()` after done
        function(message, messageDone) {
          // Process message
          var messageObject = message.toObject();
          Message.update(
            { _id: message._id },
            {
              $set: {
                notificationSent: messageObject.created,
                notificationCount: 2
              },
              $unset: {
                notified: ''
              }
            },
            {
              // Mongoose will only update fields defined in the schema.
              // However, you can override that default behavior by
              // including the `strict:false` option
              strict: false,
              // Limits updates only to one document per update
              multi: false
            },
            function(err, raw) {
              // Succesfully saved this message
              if (!err && raw.nModified === 1) {
                counter++;
              }
              // Moves on to next one in array
              messageDone(err);
            }
          );
        },
        // Final callback after all the messages are processed
        function(err) {
          if (err) {
            console.error(err);
          }
          // All done
          console.log('Processed ' + counter + ' of ' + messages.length + ' notified messages.');
          done(err);
        }
      );
    },


    // Get all un-notified message documents
    function(done) {
      Message
        .find({
          notified: false,
          notificationSent: { $exists: false }
        })
        .exec(function (err, messages) {
          if (messages) {
            console.log('Found ' + messages.length + ' un-notified messages to process.');
          }
          done(err, messages);
        });
    },

    // Update each un-notified message document
    function(messages, done) {

      // No messages to process
      if (!messages.length) {
        console.log('No un-notified messages to process');
        return done();
      }

      // Count how many messages we've processed
      var counter = 0;

      // `mapSeries` runs only a single async operation at a time
      async.mapSeries(
        messages,
        // Iterate each message using this function
        // Must call `messageDone()` after done
        function(message, messageDone) {
          // Process message
          Message.update(
            { _id: message._id },
            {
              $set: {
                notificationCount: 0
              },
              $unset: {
                notified: ''
              }
            },
            {
              // Mongoose will only update fields defined in the schema.
              // However, you can override that default behavior by
              // including the `strict:false` option
              strict: false,
              // Limits updates only to one document per update
              multi: false
            },
            function(err, raw) {
              // Succesfully saved this message
              if (!err && raw.nModified === 1) {
                counter++;
              }
              // Moves on to next one in array
              messageDone(err);
            }
          );
        },
        // Final callback after all the messages are processed
        function(err) {
          if (err) {
            console.error(err);
          }
          // All done
          console.log('Processed ' + counter + ' of ' + messages.length + ' un-notified messages.');
          done(err);
        }
      );
    }

  ], function (err) {
    if (err) {
      console.error(err);
    }
    // Disconnect before exiting
    mongooseService.disconnect(function(mongooseErr) {
      if (mongooseErr) {
        console.error(mongooseErr);
      }
      next();
    });
  });

};


exports.down = function(next) {

  next();

};

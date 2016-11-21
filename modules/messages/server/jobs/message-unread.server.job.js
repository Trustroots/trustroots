'use strict';

/**
 * Task that checks for unread messages from the DB and sends
 * notification emails for users who have unread messages.
 *
 * Won't notify for very fresh (10min) messages, or else
 * people would get email for each line of chat message somebody writes.
 *
 * Also if people are reading their messages (and thus messages get marked read),
 * notifications aren't sent.
 *
 * This whole task might be a bit memory intensive (aggregate specificly).
 */


/**
 * Module dependencies.
 */
var path = require('path'),
    log = require(path.resolve('./config/lib/logger')),
    // emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    config = require(path.resolve('./config/config')),
    async = require('async'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    // eslint-disable-next-line no-unused-vars
    messageModels = require(path.resolve('./modules/messages/server/models/message.server.model'));
    // User = mongoose.model('User');

module.exports = function(job, agendaDone) {
  console.log('Agenda unread messages');
  async.waterfall([

    // Find un-confirmed users
    function(done) {
      console.log('Agenda unread messages, aggregate:');

      // Ignore very recently signed up users
      // Returns date in the past
      // Configuration object should be something like `{ 'minutes': 10 }`
      // Has to be a JS Date object, not a Moment object
      // var createdTimeAgo = moment().subtract(moment.duration(config.limits.timeToFirstUnreadMessagesReminder)).toDate();

      // Ignore very recently reminded users
      // Returns date in the past
      // Configuration object should be something like `{ 'hours': 24 }`
      // Has to be a JS Date object, not a Moment object
      var remindedTimeAgo = moment().subtract(moment.duration(config.limits.timeToNextUnreadMessagesReminder)).toDate();

      var query = {
        $match: {
          read: false,
          // created: { $lt: createdTimeAgo },
          $and: [
            {
              // Limits number of reminder emails sent to configured amount
              // Defaults to two when falsy or zero
              notificationCount: { $lt: config.limits.maxUnreadMessagesReminders || 2 }
            },
            {
              $or: [
                { notificationSent: { $lt: remindedTimeAgo } },
                { notificationSent: { $exists: false } }
              ]
            }
          ]
        }
      };

      // Just the query
      Message.aggregate([query], function(err, queryResults) {

        console.log('queryResults (' + queryResults.length + '):');
        console.log(queryResults);
        console.log('');
        console.log('');

        // Real thing
        Message.aggregate([
          query,
          {
            $group: {

              // Group separate emails
              _id: {
                'userTo': '$userTo',
                'userFrom': '$userFrom'
              },

              // Collect unread messages count
              total: { $sum: 1 },

              // Collect message contents
              messages: {
                $push: {
                  id: '$_id',
                  content: '$content',
                  notificationCount: '$notificationCount'
                }
              }
            }
          }
        ], function(err, notifications) {
          console.log('notifications (' + notifications.length + '):');
          console.log(require('util').inspect(notifications, false, null));
          console.log('');
          console.log('----------------');
          console.log('');
          done(err, notifications);
        });

      });

    }
/*
    // Send emails
    function(users, done) {
      // No users to send emails to
      if (!users.length) {
        return done();
      }

      async.eachSeries(users, function(user, callback) {

        emailService.sendSignupEmailReminder(user, function(err) {
          if (err) {
            return callback(err);
          } else {
            // Mark reminder sent and update the reminder count
            User.findByIdAndUpdate(
              user._id,
              {
                $set: {
                  publicReminderSent: new Date()
                },
                // If the field does not exist, $inc creates the field
                // and sets the field to the specified value.
                $inc: {
                  publicReminderCount: 1
                }
              },
              function(err) {
                if (err) {
                  // Log the failure
                  log('error', 'Failed to mark user\'s reminder sent. #JLfeo3', {
                    error: err
                  });
                }
                callback(err);
              }
            );
          }
        });
      }, function(err) {
        done(err);
      });

    }
*/
  ], function(err) {
    if (err) {
      // Log the failure
      log('error', 'Error while sending unread messages. #UJKFyf', {
        error: err
      });
    }
    return agendaDone(err);
  });

};

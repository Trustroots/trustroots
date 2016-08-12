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
var _ = require('lodash'),
    path = require('path'),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    async = require('async'),
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    User = mongoose.model('User');

module.exports = function(job, agendaDone) {
  async.waterfall([

    // Aggregate unread messages
    function(done) {

      // Ignore very recent messages and look for only older than 10 minutes
      var timeAgo = new Date();
      timeAgo.setMinutes(timeAgo.getMinutes() - 10);

      Message.aggregate([
        {
          $match: {
            read: false,
            notified: false,
            created: { $lt: timeAgo }
          }
        },
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
            messages: { $push: { id: '$_id', content: '$content' } }
          }
        }
      ], function(err, notifications) {
        done(err, notifications);
      });

    },

    // Fetch userTo and userFrom  email + displayName
    function(notifications, done) {

      var userIds = [];

      notifications.forEach(function(notification) {
        // Collect user ids
        userIds.push(notification._id.userTo, notification._id.userFrom);
      });

      // Make sure we don't have huge list of dublicate user ids
      // @link https://lodash.com/docs#uniq
      userIds = _.uniq(userIds);

      // Fetch email + displayName for all users involved
      // Remember to add these values also userNotFound object (see below)
      if (userIds.length > 0) {
        User
          .find({ '_id': { $in: userIds } }, 'email displayName username')
          .exec(function(err, users) {

            // Re-organise users into more handy array
            var usersArr = [];
            if (users) {
              users.forEach(function(user) {
                usersArr[user._id] = user;
              });
            }

            done(err, usersArr, notifications);
          });
      } else {
        done(null, [], notifications);
      }
    },

    // Send emails
    function(users, notifications, done) {

      var notificationsToProcess = notifications.length;
      var messageIds = [];

      if (notificationsToProcess > 0) {

        // Create a queue worker to send notifications in parallel
        // Process at most 3 notifications at the same time
        // @link https://github.com/caolan/async#queueworker-concurrency
        var notificationsQueue = async.queue(function (notification, notificationCallback) {

          var userTo = (users[notification._id.userTo.toString()]) ? users[notification._id.userTo.toString()] : false,
              userFrom = (users[notification._id.userFrom.toString()]) ? users[notification._id.userFrom.toString()] : false;

          // Collect message ids for updating documents to `notified:true` later
          notification.messages.forEach(function(message) {
            messageIds.push(message.id);
          });

          // If we don't have info about these users, they've been removed.
          // Don't send notification mail in such case.
          if (!userTo) {
            console.error('Notification email error:');
            console.error('Could not find userTo from users table.');
            return;
          }
          if (!userFrom) {
            console.error('Notification email error:');
            console.error('Could not find userFrom from users table.');
            return;
          }

          emailService.sendMessagesUnread(userFrom, userTo, notification, notificationCallback);

        }, 5); // How many notifications to process simultaneously?

        // Start processing notifications
        notificationsQueue.push(notifications);

        // Assign a final callback to work queue
        // All notification jobs done, continue
        notificationsQueue.drain = function(err) {
          if (err) {
            console.error('Sending message notification mails caused an error:');
            console.error(err);
          }

          done(null, messageIds);
        };
      } else {
        // No users to send emails to
        done(null, []);
      }

    },

    // Mark messages notified
    function(messageIds, done) {

      if (messageIds.length > 0) {
        Message.update(
          { _id: { '$in': messageIds } },
          { $set: { notified: true } },
          { multi: true },
          function(err) {
            if (err) {
              console.error('Error while marking messages as notified.');
              console.error(err);
            }
            done(err);
          });
      } else {
        done(null);
      }

    }

  ], function(err) {
    if (err) {
      job.fail(err);
      job.save();
    }
    // Wrap it up
    return agendaDone();
  });

};

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
    facebookNotificationService = require(path.resolve('./modules/core/server/services/facebook-notification.server.service')),
    pushService = require(path.resolve('./modules/core/server/services/push.server.service')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    log = require(path.resolve('./config/lib/logger')),
    async = require('async'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    User = mongoose.model('User');

module.exports = function(job, agendaDone) {

  async.waterfall([

    // Aggregate unread messages
    function(done) {

      // Ignore very recent messages and look for only older than 10 minutes
      // Has to be a JS Date object, not a Moment object
      var createdTimeAgo = moment().subtract(moment.duration({ 'minutes': 1 })).toDate();

      Message.aggregate([
        {
          $match: {
            read: false,
            notified: false,
            created: { $lt: createdTimeAgo }
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

    // Fetch details for `userTo` and `userFrom`
    function(notifications, done) {

      var userIds = [];

      // Collect all user ids from notifications
      notifications.forEach(function(notification) {
        userIds.push(notification._id.userTo, notification._id.userFrom);
      });

      // Make sure we don't have huge list of dublicate user ids
      // @link https://lodash.com/docs#uniq
      userIds = _.uniq(userIds);

      // Fetch email + displayName for all users involved
      // Remember to add these values also userNotFound object (see below)
      if (userIds.length > 0) {
        User
          .find(
          { '_id': { $in: userIds } },
          [
            // Fields to get for each user:
            'email',
            'displayName',
            'username',
            'pushRegistration.token',
            'additionalProvidersData.facebook.id',
            'additionalProvidersData.facebook.accessToken',
            'additionalProvidersData.facebook.accessTokenExpires'
          ].join(' ')
          )
          .exec(function(err, users) {

            // Re-organise users into more handy array (`collectedUsers`)
            var collectedUsers = {};
            if (users) {
              users.forEach(function(user) {
                // @link https://lodash.com/docs/#set
                // _.set(object, path, value)
                _.set(collectedUsers, user._id.toString(), user);
              });
            }

            done(err, collectedUsers, notifications);
          });
      } else {
        done(null, [], notifications);
      }
    },

    // Send Notifications
    function(users, notifications, done) {

      // No notifications
      if (!notifications.length) {
        return done(null, []);
      }

      // Create a queue worker to send notifications in parallel
      // Process at most 3 notifications at the same time
      // @link https://github.com/caolan/async#queueworker-concurrency
      var notificationsQueue = async.queue(function (notification, notificationCallback) {

        var userTo = _.get(users, notification._id.userTo.toString(), false),
            userFrom = _.get(users, notification._id.userFrom.toString(), false);

        // If we don't have info about these users, they've been removed.
        // Don't send notification mail in such case.
        // Message will still be marked as notified.
        if (!userFrom || !userTo) {
          return notificationCallback(new Error('Could not find all users relevant for this message to notify about. #j93bvs'));
        }

        // Process first emails, then FB notifications
        // After both are done, calls `notificationCallback(err, res)`
        async.series({
          email: function(callback) {
            emailService.sendMessagesUnread(userFrom, userTo, notification, callback);
          },
          facebook: function(callback) {
            facebookNotificationService.notifyMessagesUnread(userFrom, userTo, notification, callback);
          },
          push: function(callback) {
            pushService.notifyMessagesUnread(userFrom, userTo, notification, callback);
          }
        }, notificationCallback);

      }, 5); // How many notifications to process simultaneously?

      // Start processing notifications
      notificationsQueue.push(notifications);

      // Assign a final callback to work queue
      // All notification jobs done, continue
      notificationsQueue.drain = function(err) {
        // Log detected error but don't stop processing this job because of it
        // Otherwise this job might get stuck infinitely for some notification
        if (err) {
          // Log the failure to send the notification
          log('error', 'Sending unread message notifications caused an error. #j38vax', {
            error: err
          });
        }
        done(null, notifications);
      };

    },

    // Mark messages notified
    function(notifications, done) {

      // No notifications
      if (!notifications.length) {
        return done(null);
      }

      // Holds ids of messages to be set `notified:true`
      var messageIds = [];

      // Collect message ids for updating documents to `notified:true` later
      for (var i = 0, len = notifications.length; i < len; i++) {
        if (notifications[i].messages) {
          notifications[i].messages.forEach(function(message) {
            messageIds.push(message.id);
          });
        }
      }

      // No message ids (shouldn't happen, but just in case)
      if (!messageIds.length) {
        // Log the failure to send the notification
        log('warn', 'No messages to set notified. This probably should not happen. #hg38vs');
        return done(null);
      }

      // Update messages using ids
      Message.update(
        { _id: { '$in': messageIds } },
        { $set: { notified: true } },
        { multi: true },
        function(err) {
          if (err) {
            // Log the failure to send the notification
            log('error', 'Error while marking messages as notified. #9ehvbn', {
              error: err
            });
          }
          // Now fail the job if error happens
          done(err);
        });

    }

  ], function(err) {
    // Wrap it up
    return agendaDone(err);
  });

};

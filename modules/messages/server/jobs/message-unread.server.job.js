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
 *
 * Further notifications are sent if the message stays unread
 * and belongs to an unreplied thread.
 *
 * Timing of the notifications is configured in config/env/default.js
 * in property `limits.unreadMessageReminders`.
 *
 * The further notifications are not sent when too much time passed
 * since the last unread message was sent.
 * The time limit for further notifications is configured in config/env/default.js
 * in property `limits.unreadMessageRemindersTooLate`.
 *
 * Note: we use terms `notification` and `reminder` as synonyms here
 */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const facebookNotificationService = require(path.resolve(
  './modules/core/server/services/facebook-notification.server.service',
));
const pushService = require(path.resolve(
  './modules/core/server/services/push.server.service',
));
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const log = require(path.resolve('./config/lib/logger'));
const config = require(path.resolve('./config/config'));
const async = require('async');
const moment = require('moment');
const mongoose = require('mongoose');
const Message = mongoose.model('Message');
const User = mongoose.model('User');

module.exports = function (job, agendaDone) {
  // read timing of notifications from config
  // we expect an array of momentjs objects
  // i.e. [{ minutes: 10 }, { hours: 24 }]
  const remindersConfig = config.limits.unreadMessageReminders;

  // sort the config from the earliest to the latest
  const sortedConfig = _.sortBy(remindersConfig, function (timeSinceMessage) {
    return moment.duration(timeSinceMessage).asMilliseconds();
  });

  /*
   * we run the reminders from the last to the first.
   * that way we avoid duplicates when more reminders are pending
   * i.e. when notificationCount is 0 and 24 hours already passed (maybe due to some agenda outage)
   * we run the 2nd reminder first, the notificationCount is set to 2
   * and the 1st reminder is not sent at all
   *
   * otherwise both reminders would be sent at the same time o_O
   *
   * hopefully there is not much harm in sending just one reminder in total
   * this case shouldn't happen too often
   */
  const remappedConfig = _.reverse(
    _.map(sortedConfig, function (value, index) {
      // remapped config for nth notifications, more comfortable for further use
      return {
        order: index, // nth notification
        timing: value, // when to send the notification
      };
    }),
  );

  // for every config, send the appropriate notifications
  async.eachSeries(remappedConfig, sendUnreadMessageReminders, agendaDone);
};

/**
 * Send the reminders about unread messages to various services
 * @param {Object} reminder - configuration for nth reminder
 * @param {Object} reminder.timing - How much time must pass (since the last unread message) to send the nth reminder.
 * A time object as momentjs would expect it, i.e. { 'minutes': 10 }
 * @param {number} reminder.order - Order of the reminder. The reminder is nth.
 * We start counting from 0. i.e. 3rd reminder has reminder.order: 2
 * @param {Function} callback - a callback function
 */
function sendUnreadMessageReminders(reminder, callback) {
  const timePassed = reminder.timing;
  const reminderOrder = reminder.order;

  async.waterfall(
    [
      // Aggregate unread messages
      function (done) {
        // We want to remind user about messages, which remain unread for more than `timePassed`
        // Has to be a JS Date object, not a Moment object
        const createdTimeAgo = moment()
          .subtract(moment.duration(timePassed))
          .toDate();

        // Find all the unread messages which fit the reminder config requirements
        Message.aggregate(
          [
            {
              $match: {
                read: false,
                // first reminder is sent when notificationCount is 0
                // second reminder is sent when notificationCount is 0 or 1
                // etc...
                notificationCount: { $lte: reminderOrder },
                created: { $lt: createdTimeAgo },
              },
            },
            {
              $group: {
                // Group separate emails
                _id: {
                  userTo: '$userTo',
                  userFrom: '$userFrom',
                },

                // Collect unread messages count
                total: { $sum: 1 },

                // Collect message contents
                messages: {
                  $push: {
                    id: '$_id',
                    content: '$content',
                    created: '$created',
                  },
                },

                // did we already send some notifications for the last unseen message?
                // the last unseen message has the minimum notification count
                // we'll use the value to determine whether the notification is the first one, or not; to change wording of the reminder
                notificationCount: { $min: '$notificationCount' },
              },
            },
          ],
          function (err, notifications) {
            done(err, notifications);
          },
        );
      },

      /*
       * If we're about to send non-first notification
       * we want to see, whether it belongs to an unreplied thread.
       * We send the further notifications only to unreplied threads.
       * we save the value in boolean: notification.dontSend
       *
       * We also don't want to send it when it is too late (config.limits.unreadMessageRemindersTooLate)
       */
      function (notifications, done) {
        // we pick only notifications which already have count > 0
        // the first ones we want to send for sure, so we keep `notification.dontSend` undefined
        const furtherNotifications = _.filter(
          notifications,
          function (notification) {
            return notification.notificationCount > 0;
          },
        );

        // check whether the thread is non-replied
        async.eachSeries(
          furtherNotifications,
          function (notification, checkDone) {
            // count messages in the other direction
            Message.countDocuments(
              {
                userFrom: notification._id.userTo,
                userTo: notification._id.userFrom,
              },
              function (err, count) {
                const isThreadReplied = count > 0;

                // find out whether it is too late to send the further notification
                // we just wrap it to function for clearer organisation
                const isTooLate = (function () {
                  const lastMessage = _.maxBy(
                    notification.messages,
                    function (msg) {
                      return msg.created;
                    },
                  );
                  const tooLate = config.limits.unreadMessageRemindersTooLate;
                  const tooOld = moment()
                    .subtract(moment.duration(tooLate))
                    .toDate();
                  return lastMessage.created < tooOld;
                })();

                if (isThreadReplied || isTooLate) {
                  notification.dontSend = true;
                }

                checkDone(err);
              },
            );
          },
          function (err) {
            return done(err, notifications);
          },
        );
      },

      // Fetch details for `userTo` and `userFrom`
      function (notifications, done) {
        let userIds = [];

        // Collect all user ids from notifications
        notifications.forEach(function (notification) {
          userIds.push(notification._id.userTo, notification._id.userFrom);
        });

        // Make sure we don't have huge list of dublicate user ids
        // @link https://lodash.com/docs#uniq
        userIds = _.uniq(userIds);

        // Fetch email + displayName for all users involved
        // Remember to add these values also userNotFound object (see below)
        if (userIds.length > 0) {
          User.find(
            { _id: { $in: userIds } },
            [
              // Fields to get for each user:
              'email',
              'displayName',
              'username',
              // Used for web/mobile push notifications:
              'pushRegistration.token',
              'pushRegistration.platform',
              // Used for FB notifications:
              'additionalProvidersData.facebook.id',
              'additionalProvidersData.facebook.accessToken',
              'additionalProvidersData.facebook.accessTokenExpires',
            ].join(' '),
          ).exec(function (err, users) {
            // Re-organise users into more handy array (`collectedUsers`)
            const collectedUsers = {};
            if (users) {
              users.forEach(function (user) {
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
      function (users, notifications, done) {
        // No notifications
        if (!notifications.length) {
          return done(null, []);
        }

        // Create a queue worker to send notifications in parallel
        // Process at most 3 notifications at the same time
        // @link https://github.com/caolan/async#queueworker-concurrency
        const notificationsQueue = async.queue(function (
          notification,
          notificationCallback,
        ) {
          const userTo = _.get(
            users,
            notification._id.userTo.toString(),
            false,
          );
          const userFrom = _.get(
            users,
            notification._id.userFrom.toString(),
            false,
          );

          // If we don't have info about these users, they've been removed.
          // Don't send notification mail in such case.
          // Message will still be marked as notified.
          if (!userFrom || !userTo) {
            return notificationCallback(
              new Error(
                'Could not find all users relevant for this message to notify about. #j93bvs',
              ),
            );
          }

          // Process email notifications
          //
          // finish early if we don't want to send it
          if (notification.dontSend === true) {
            return notificationCallback();
          }

          // Process first emails, then FB notifications
          // After both are done, calls `notificationCallback(err, res)`
          async.series(
            {
              email(callback) {
                emailService.sendMessagesUnread(
                  userFrom,
                  userTo,
                  notification,
                  callback,
                );
              },
              facebook(callback) {
                facebookNotificationService.notifyMessagesUnread(
                  userFrom,
                  userTo,
                  notification,
                  callback,
                );
              },
              push(callback) {
                pushService.notifyMessagesUnread(
                  userFrom,
                  userTo,
                  notification,
                  callback,
                );
              },
            },
            notificationCallback,
          );
        },
        5); // How many notifications to process simultaneously?

        // Start processing notifications
        notificationsQueue.push(notifications);

        // Assign a final callback to work queue
        // All notification jobs done, continue
        notificationsQueue.drain = function (err) {
          // Log detected error but don't stop processing this job because of it
          // Otherwise this job might get stuck infinitely for some notification
          if (err) {
            // Log the failure to send the notification
            log(
              'error',
              'Sending unread message notifications caused an error. #j38vax',
              {
                error: err,
              },
            );
          }
          done(null, notifications);
        };
      },

      // Update notificationCount of messages
      function (notifications, done) {
        // No notifications
        if (!notifications.length) {
          return done(null);
        }

        // Holds ids of messages to be set `notified:true`
        const messageIds = [];

        // Collect message ids for updating documents to `notified:true` later
        for (let i = 0, len = notifications.length; i < len; i++) {
          if (notifications[i].messages) {
            notifications[i].messages.forEach(function (message) {
              messageIds.push(message.id);
            });
          }
        }

        // No message ids (shouldn't happen, but just in case)
        if (!messageIds.length) {
          // Log the failure to send the notification
          log(
            'warn',
            'No messages to set notified. This probably should not happen. #hg38vs',
          );
          //
          return done(null);
        }

        // Update messages using ids
        // The first reminder has position 0, so we want to set to 1
        // The second reminder has position 1, so we want to set to 2
        // TODO the messageCount is not strictly messageCount because this update allows setting 0 to 2 and sending just 1 notification.
        Message.update(
          { _id: { $in: messageIds } },
          { $set: { notificationCount: reminderOrder + 1 } },
          { multi: true },
          function (err) {
            if (err) {
              // Log the failure to send the notification
              log(
                'error',
                'Error while marking messages as notified. #9ehvbn',
                {
                  error: err,
                },
              );
            }
            // Now fail the job if error happens
            done(err);
          },
        );
      },
    ],
    function (err) {
      // Wrap it up
      //
      return callback(err);
    },
  );
}

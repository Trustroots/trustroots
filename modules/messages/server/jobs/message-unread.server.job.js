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
    config = require(path.resolve('./config/config')),
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller')),
    emailsHandler = require(path.resolve('./modules/core/server/controllers/emails.server.controller')),
    nodemailer = require('nodemailer'),
    async = require('async'),
    swig = require('swig'),
    htmlToText = require('html-to-text'),
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    User = mongoose.model('User');

exports.checkUnreadMessages = function(agenda) {
  agenda.define('check unread messages', {lockLifetime: 10000}, function(job, agendaDone) {
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
                'userFrom': '$userFrom',
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
        if(userIds.length > 0) {
          User
            .find({ '_id': { $in: userIds } }, 'email displayName username')
            .exec(function(err, users) {

              // Re-organise users into more handy array
              var usersArr = [];
              if(users) {
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

      // Connect to SMTP
      function(users, notifications, done) {

        // Replace mailer with Stub mailer transporter
        // Stub transport does not send anything, it builds the mail stream into a single Buffer and returns
        // it with the sendMail callback. This is useful for testing the emails before actually sending anything.
        // @link https://github.com/andris9/nodemailer-stub-transport
        if (process.env.NODE_ENV === 'test') {
          var stubTransport = require('nodemailer-stub-transport');
          config.mailer.options = stubTransport();
        }

        if(notifications.length > 0) {

          // Create SMTP connection
          var smtpTransport = nodemailer.createTransport(config.mailer.options);

          // Verify connection configuration
          // If it returns an error, then something is not correct,
          // otherwise the server is ready to accept messages.
          smtpTransport.verify(function(err, success) {
            done(err, users, notifications, smtpTransport);
          });

        } else {
          done(null, users, notifications, null);
        }
      },

      // Send emails
      function(users, notifications, smtpTransport, done) {

        var notificationsToProcess = notifications.length;

        if(smtpTransport && notificationsToProcess > 0) {

          var url = (config.https ? 'https' : 'http') + '://' + config.domain,
              messageIds = [];

          // Create a queue worker to send notifications in parallel
          // Process at most 3 notifications at the same time
          // @link https://github.com/caolan/async#queueworker-concurrency
          var notificationsQueue = async.queue(function (notification, notificationCallback) {

            var userTo = (users[notification._id.userTo.toString()]) ? users[notification._id.userTo.toString()] : false,
                userFrom = (users[notification._id.userFrom.toString()]) ? users[notification._id.userFrom.toString()] : false,
                messageCount = notification.messages.length;

            // Collect message ids for updating documents to `notified:true` later
            notification.messages.forEach(function(message) {
              messageIds.push(message.id);
            });

            // If we don't have info about these users, they've been removed.
            // Don't send notification mail in such case.
            if(!userTo) {
              console.error('Notification email error:');
              console.error('Could not find userTo from users table.');
              return;
            }
            if(!userFrom) {
              console.error('Notification email error:');
              console.error('Could not find userFrom from users table.');
              return;
            }

            // Generate mail subject
            var mailSubject = userFrom.displayName + ' wrote you from Trustroots';

            // URLs to use at email templates
            var urlUserFromProfile = url + '/profile/' + userFrom.username,
                urlReply = url + '/messages/' + userFrom.username;

            // Variables passed to email text/html templates
            var renderVars = emailsHandler.addEmailBaseTemplateParams(
              config.domain,
              {
                mailTitle: mailSubject,
                messageCount: messageCount,
                messages: notification.messages,
                userFromName: userFrom.displayName,
                userToName: userTo.displayName,
                urlReplyPlainText: urlReply,
                urlReply: analyticsHandler.appendUTMParams(urlReply, {
                  source: 'transactional-email',
                  medium: 'email',
                  campaign: 'messages-unread',
                  content: 'reply-to'
                }),
                urlUserFromProfilePlainText: urlUserFromProfile,
                urlUserFromProfile: analyticsHandler.appendUTMParams(urlUserFromProfile, {
                  source: 'transactional-email',
                  medium: 'email',
                  campaign: 'messages-unread',
                  content: 'profile'
                })
              },
              'messages-unread'
            );

            // Generate plain text and html versions of the email
            var mailBodyText = swig.renderFile(path.resolve('./modules/core/server/views/email-templates-text/messages-unread.server.view.html'), renderVars);
            var mailBodyHtml = swig.renderFile(path.resolve('./modules/core/server/views/email-templates/messages-unread.server.view.html'), renderVars);

            smtpTransport.sendMail({
                to: {
                  name: userTo.displayName,
                  address: userTo.email
                },
                from: {
                  name: userFrom.displayName + ' (via Trustroots)', // Sender's own name
                  address: config.mailer.from // Trustroots email
                },
                subject: mailSubject,
                text: mailBodyText,
                html: mailBodyHtml
              },
              function(smtpErr, info) {
                // Sending email to this user failed
                // Raise warnings and continue with the next one.
                if(smtpErr) {
                  console.error('Sending message notification mail failed! user to:');
                  console.error(smtpErr);
                  console.error('userTo: ' + notification._id.userTo.toString()+ ', userFrom ' + notification._id.userFrom.toString());
                }

                notificationCallback(smtpErr);
              });

          }, 5); // How many notifications to process simultaneously?

          // Start processing notifications
          notificationsQueue.push(notifications);

          // Assign a final callback to work queue
          // All notification jobs done, continue
          notificationsQueue.drain = function(err, results) {
            if(err) {
              console.error('Sending message notification mails caused an error:');
              console.error(err);
            }

            // Close the connection pool
            smtpTransport.close();
            done(null, messageIds);
          };

        }
        // No users to send emails to
        else {
          done(null, []);
        }

      },

      // Mark messages notified
      function(messageIds, done) {

        if(messageIds.length > 0) {
          Message.update(
            { _id : {'$in': messageIds } },
            { $set: { notified: true } },
            { multi: true },
            function(err, num, raw) {
              if(err) {
                console.error('Error while marking messages as notified.');
                console.error(err);
              }
              done(err);
            });
        }
        else {
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

  }); //agenda.define

};

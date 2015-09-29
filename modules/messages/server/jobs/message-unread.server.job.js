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
    nodemailer = require('nodemailer'),
    async = require('async'),
    //swig = require('swig'),
    htmlToText = require('html-to-text'),
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    User = mongoose.model('User');

exports.checkUnreadMessages = function(agenda) {
  agenda.define('check unread messages', {lockLifetime: 10000}, function(job, agendaDone) {

    async.waterfall([

      // Aggregate unread messages
      function(done) {

        // Ignore very recent messages and look for only older than 15 minutes
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

              // Whom we'll send notification emails
              _id: '$userTo',

              // Collect unread messages count
              //total: { $sum: 1 },

              // Collect message contents
              messages: { $push: { id: '$_id', content: '$content', userFrom: '$userFrom' } }
            }
          }
        ], function(err, notifications) {
          done(err, notifications, timeAgo);
        });

      },

      // Fetch userTo and userFrom  email + displayName
      function(notifications, timeAgo, done) {

        var userIds = [];

        notifications.forEach(function(notification) {
          // Collect receiver ids
          userIds.push(notification._id);

          // Look trough messages and their sender ids
          notification.messages.forEach(function(message) {
            userIds.push(message.userFrom);
          });
        });

        // Make sure we don't have huge list of dublicate user ids
        userIds = _.unique(userIds);

        // Fetch email + displayName for all users involved
        // Remember to add these values also userNotFound object (see below)
        if(userIds.length > 0) {
          User
            .find({ '_id': { $in: userIds } }, 'email displayName')
            .exec(function(err, users) {

              // Reorganise users into more handy array
              var usersArr = [];
              if(users) {
                users.forEach(function(user) {
                  usersArr[user._id] = user;
                });
              }

              done(err, usersArr, notifications, timeAgo);
            });
        } else {
          done(null, [], notifications, timeAgo);
        }
      },

      // Send emails
      function(users, notifications, timeAgo, done) {

        if(notifications.length > 0) {

          var smtpTransport = nodemailer.createTransport(config.mailer.options),
              url = (config.https ? 'https' : 'http') + '://' + config.domain,
              userNotFound = {displayName: 'Anonymous', email: config.mailer.from};

          // Loop notifications trough and send them
          notifications.forEach(function(notification) {

            var userTo = users[notification._id],
                total = notification.messages.length;

            // Compile messages into one feed
            // @todo: move this to a Twig template (text + html)
            var messageFeed = '----------------------------------------------------------------------\n\r\n\r';
            notification.messages.forEach(function(message) {

              // Get user's info from user array. Handles deleted users.
              var userFrom = (users[message.userFrom]) ? users[message.userFrom] : userNotFound;

              messageFeed += userFrom.displayName + ' writes:\n\r\n\r';
              messageFeed += htmlToText.fromString(message.content, {wordwrap: 80});
              messageFeed += '\n\r\n\r----------------------------------------------------------------------\n\r\n\r';
            });

            var mailTitle = (total > 1) ? 'You have ' + total + ' unread messages at Trustroots' : 'You have one unread message at Trustroots';

            var mailBody = mailTitle + '.\n\r\n\r' +
                           'DO NOT REPLY THIS EMAIL DIRECTLY. \n\r\n\rGo to ' + url + '/messages to reply.\n\r\n\r' +
                           messageFeed +
                           'DO NOT REPLY THIS EMAIL DIRECTLY. \n\r\n\rGo to ' + url + '/messages to reply.\n\r\n\r' +
                           '-- \n\rTrustroots\n\r' + url + '\n\r' +
                           'Support: ' + url + '/contact/\n\rSupport email: ' + config.mailer.from + '\n\r';

            smtpTransport.sendMail({
                to: {
                  name: userTo.displayName,
                  address: userTo.email
                },
                from: 'Trustroots <' + config.mailer.from + '>',
                subject: mailTitle,
                text: mailBody
              }, function(smtpErr, info) {

                // Sending email to this user failed
                // Raise warnings and continue with the next one.
                if(smtpErr) {
                  console.error('Sending message notification mail failed! ' + userTo.displayName);
                  console.error(smtpErr);
                  console.error(notification);
                  return;
                }
            });

            // close the connection pool
            smtpTransport.close();
            done(null, notifications, timeAgo);
          });

        }
        // No users to send emails to
        else {
          done(null, [], false);
        }

      },

      // Mark messages notified
      function(notifications, timeAgo, done) {

        if(timeAgo && notifications.length > 0) {
          // timeAgo will be the same when aggregating posts
          Message.update(
            {
              read: false,
              notified: false,
              created: { $lt: timeAgo }
            },
            { $set: { notified: true } },
            { multi: true },
            function(err, num, raw) {
              done(err);
            }
          );
        }
        else {
          done(null);
        }

      },

      // No errors, wrap it up
      function(done) {
        agendaDone();
      }

    ], function(err) {
      if (err) {
        job.fail(err);
        job.save();
      }
      agendaDone();
    });

  }); //agenda.define

};//checkUnreadMessages

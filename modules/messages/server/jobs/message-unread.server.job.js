'use strict';

/*
* Task that checks for unread messages from the DB and sends
* notification emails for users who have unread messages.
*
* Won't notify for very fresh (15min) messages, or else
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
    mongoose = require('mongoose'),
    Message = mongoose.model('Message'),
    User = mongoose.model('User');

exports.checkUnreadMessages = function(agenda) {
  agenda.define('check unread messages', function(job, agendaDone) {

    async.waterfall([

      // Aggregate unread messages
      function(done) {

        // Ignore very recent messages and look for only older than 15 minutes
        var timeAgo = new Date();
        timeAgo.setMinutes(timeAgo.getMinutes() - 15);

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

              // This could be useful info at emails sent to users
              //total: { $sum: 1 }

              // Collect message ids for marking them notified
              //messages: { $push: '$_id' }
            }
          }
        ], function(err, toBeNotified) {
          done(err, toBeNotified, timeAgo);
        });

      },

      // Fetch user emails
      function(toBeNotified, timeAgo, done) {

        // Construct separate simple array for user-ids
        var userIds = [];

        // Collect user ids
        toBeNotified.forEach(function(notification) {
          userIds.push(notification._id);
        });

        // Fetch email addresses for those users
        User
        .find({ '_id': { $in: userIds } }, 'email')
        .exec(function(err, users) {
          done(err, users, timeAgo);
        });

      },


      /*
       * Skipping this for now and using text-only emails instead.
       * We'll first need to re-render our html templates from
       * header+content+footer parts and then use that file for this.
       *
       */
      // Prepare mail
      /*
      function(users, emailTemplate, done) {
        swig.render('./app/views/email-templates/messages-unread.server.view.html', {
          ourMail: config.mailer.from,
          urlInbox: (config.https ? 'https' : 'http') + '://' + config.domain + '/messages',
        }, function(err, emailHTML) {
          done(err, emailHTML, users);
        });
      },
      */

      // Send emails
      function(users, timeAgo, done) {

        if(users.length > 0) {

          var smtpTransport = nodemailer.createTransport(config.mailer.options);
          var url = (config.https ? 'https' : 'http') + '://' + config.domain;

          var emailSignature = '-- \n\rTrustroots\n\r' + url + '\n\rSupport: ' + url + '/contact/\n\rSupport email: hello@trustroots.org\n\r';

          // Loop users
          users.forEach(function(user) {
            smtpTransport.sendMail({
              to: user.email,
              from: 'Trustroots <' + config.mailer.from + '>',
              subject: 'You have unread message(s)',
              text: 'You have unread messages at Trustroots.\n\r\n\rTo read them, go to ' + url + '/messages\n\r\n\r' + emailSignature
            });
          });

          smtpTransport.close(); // close the connection pool
          done(null, timeAgo);

        }
        // No users to send emails to
        else {
          done(null, timeAgo);
        }

      },

      // Mark messages notified
      function(timeAgo, done) {

        // timeAgo will be the same when aggregating posts
        // @todo: any more optimised way of doing it?
        Message.update(
          {
            //$match: {
              read: false,
              notified: false,
              created: { $lt: timeAgo }
            //}
          },
          { $set: { notified: true } },
          { multi: true },
          function(err, num, raw) {
            done(err);
          }
        );

      },

      // No errors, wrap it up
      function(done) {
        agendaDone();
      }

    ], function(err) {
      if (err) {
        console.log('[agenda] Error while checking for unread messages:');
        console.log(err);
      }
    });

  }); //agenda.define

};//checkUnreadMessages

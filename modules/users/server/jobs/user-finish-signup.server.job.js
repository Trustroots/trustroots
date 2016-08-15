'use strict';

/**
 * Task that checks for users who didn't finish their signup process and thus
 * have `public:false` in their profile. The script sends 3 reminder emails
 * to these users in 3 day intervals, starting 24h after signup.
 *
 * Keeps count of reminder emails at user's model.
 */


/**
 * Module dependencies.
 */
var path = require('path'),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    async = require('async'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

// How many reminder emails we should send?
var maxReminders = 3;

module.exports = function(job, agendaDone) {
  async.waterfall([

    // Find un-confirmed users
    function(done) {

      // Ignore very recently signed up users
      var createdTimeAgo = moment().subtract(moment.duration({ 'hours': 4 }));

      // Ignore very recently reminded users
      var remindedTimeAgo = moment().subtract(moment.duration({ 'days': 2 }));

      User
        .find({
          public: false,
          created: {
            $lt: createdTimeAgo
          }
        })
        .and([
          {
            $or: [
              { publicReminderCount: { $lt: maxReminders } },
              { publicReminderCount: { $exists: false } }
            ]
          },
          {
            $or: [
              { publicReminderSent: { $lt: remindedTimeAgo } },
              { publicReminderSent: { $exists: false } }
            ]
          }
        ])
        .limit(50)
        .exec(function(err, users) {
          done(err, users);
        });

    },

    // Send emails
    function(users, done) {

      if (users.length > 0) {

        users.forEach(function(user) {

          emailService.sendSignupEmailReminder(user, function(err) {
            if (err) {
              console.error('Failed to send user\'s reminder.');
              console.error(err);
              // Continue regardless the failure so that we can process other
              // reminders without getting stuck here
              done();
            } else {
              // Mark reminder sent and update the reminder count
              User.findByIdAndUpdate(
                { _id: user._id },
                {
                  publicReminderSent: new Date(),
                  $inc: { publicReminderCount: 1 }
                },
                function(err) {
                  if (err) {
                    console.error('Failed to mark user\'s reminder sent.');
                    console.error(err);
                  }
                  done();
                }
              );
            }
          });

        });
      } else {
        // No users to send emails to
        done();
      }

    }

  ], function(err) {
    return agendaDone(err);
  });

};

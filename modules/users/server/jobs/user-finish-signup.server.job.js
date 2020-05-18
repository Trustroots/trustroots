/**
 * Task that checks for users who didn't finish their signup process and thus
 * have `public:false` in their profile. The script sends 3 (configurable)
 * reminder emails to these users in 2 day intervals, starting 4h after signup.
 *
 * Ignores users with `suspended` role.
 *
 * Keeps count of reminder emails at user's model.
 */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));
const async = require('async');
const moment = require('moment');
const mongoose = require('mongoose');
const User = mongoose.model('User');

module.exports = function (job, agendaDone) {
  async.waterfall(
    [
      // Find un-confirmed users
      function (done) {
        // Ignore very recently signed up users
        const createdTimeAgo = moment().subtract(moment.duration({ hours: 4 }));

        // Ignore very recently reminded users
        const remindedTimeAgo = moment().subtract(moment.duration({ days: 2 }));

        User.find({
          public: false,
          created: {
            $lt: createdTimeAgo,
          },
          // Exlude users with `suspended` role
          roles: {
            $elemMatch: {
              $ne: 'suspended',
            },
          },
        })
          .and([
            {
              $or: [
                {
                  publicReminderCount: {
                    $lt: config.limits.maxSignupReminders || 3,
                  },
                },
                { publicReminderCount: { $exists: false } },
              ],
            },
            {
              $or: [
                { publicReminderSent: { $lt: remindedTimeAgo } },
                { publicReminderSent: { $exists: false } },
              ],
            },
          ])
          .limit(config.limits.maxProcessSignupReminders || 50)
          .exec(function (err, users) {
            done(err, users);
          });
      },

      // Send emails
      function (users, done) {
        // No users to send emails to
        if (!users.length) {
          return done();
        }

        async.eachSeries(
          users,
          function (user, callback) {
            emailService.sendSignupEmailReminder(user, function (err) {
              if (err) {
                return callback(err);
              } else {
                // Mark reminder sent and update the reminder count
                User.findByIdAndUpdate(
                  user._id,
                  {
                    $set: {
                      publicReminderSent: new Date(),
                    },
                    // If the field does not exist, $inc creates the field
                    // and sets the field to the specified value.
                    $inc: {
                      publicReminderCount: 1,
                    },
                  },
                  function (err) {
                    callback(err);
                  },
                );
              }
            });
          },
          function (err) {
            done(err);
          },
        );
      },
    ],
    function (err) {
      if (err) {
        // Get job id from Agenda job attributes
        // Agenda stores Mongo `ObjectId` so turning that into a string here
        log('error', 'Failure in finish signup reminder background job.', {
          error: err,
          jobId: _.get(job, 'attrs._id').toString(),
        });
      }
      return agendaDone(err);
    },
  );
};

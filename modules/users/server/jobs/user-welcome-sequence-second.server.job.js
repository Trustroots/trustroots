/**
 * Onboarding/welcome sequence email for new members: 2/3
 *
 * Ignores users with `suspended` role.
 *
 * Keeps count of onboarding emails at user's model.
 */


/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    log = require(path.resolve('./config/lib/logger')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    config = require(path.resolve('./config/config')),
    async = require('async'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

module.exports = function (job, agendaDone) {

  // Ignore very recently confirmed (i.e. signed up) users
  var previousEmailSentTimeAgo = moment().subtract(moment.duration(config.limits.welcomeSequence.second));

  async.waterfall([

    // Find un-welcomed users
    function (done) {

      User
        .find({
          // User has confirmed their email
          public: true,

          // One of the welcome sequence emails was sent out to them previously
          welcomeSequenceStep: 1,

          // Wait for x hours after email confirmation before sending
          // the first welcome sequence email
          welcomeSequenceSent: { $lt: previousEmailSentTimeAgo },

          // Exlude users with `suspended` role
          roles: {
            $elemMatch: {
              $ne: 'suspended'
            }
          }
        })
        // Limit stops any crazy amounts of emails being processed at once
        // the rest would be processed in next round.
        .limit(50)
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

      async.eachSeries(users, function (user, callback) {

        emailService.sendWelcomeSequenceSecond(user, function (err) {
          if (err) {
            return callback(err);
          } else {
            // Mark reminder sent and update the reminder count
            User.findByIdAndUpdate(
              user._id,
              {
                $set: {
                  welcomeSequenceSent: new Date()
                },
                // If the field does not exist, $inc creates the field
                // and sets the field to the specified value.
                $inc: {
                  welcomeSequenceStep: 1
                }
              },
              function (err) {
                callback(err);
              }
            );
          }
        });
      }, function (err) {
        done(err);
      });

    }

  ], function (err) {
    if (err) {
      log('error', 'Failure in second welcome sequence background job.', {
        error: err,
        jobId: _.get(job, 'attrs._id').toString()
      });
    }
    return agendaDone(err);
  });

};

/**
 * Task that checks for hosting offers that are set to "no" and were modified
 * longer than 3 months ago. Sends these users one reminder asking if they still
 * would like to keep their hosting status as "no".
 *
 * Keeps count of reminder emails at offer model.
 */


/**
 * Module dependencies.
 */
var path = require('path'),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    config = require(path.resolve('./config/config')),
    async = require('async'),
    moment = require('moment'),
    log = require(path.resolve('./config/lib/logger')),
    mongoose = require('mongoose'),
    Offer = mongoose.model('Offer');

module.exports = function (job, agendaDone) {
  async.waterfall([

    // Find "no" hosting offers
    function (done) {

      // Ignore only offers modified within past X days
      // Has to be a JS Date object, not a Moment object
      var updatedTimeAgo = moment().subtract(moment.duration(config.limits.timeToReactivateHosts)).toDate();

      Offer
        .find({
          type: 'host',
          status: 'no',
          updated: {
            $lt: updatedTimeAgo
          },
          // Only offers we didn't notify yet
          reactivateReminderSent: {
            $exists: false
          }
        })
        .populate('user', 'public email firstName displayName')
        .exec(function (err, offers) {
          done(err, offers || []);
        });
    },

    // Send emails
    function (offers, done) {
      // No users to send emails to
      if (!offers.length) {
        return done();
      }

      async.eachSeries(offers, function (offer, callback) {

        emailService.sendReactivateHosts(offer.user, function (err) {
          if (err) {
            return callback(err);
          } else {
            // Mark reactivation mail sent
            Offer.findByIdAndUpdate(
              offer._id,
              {
                $set: {
                  reactivateReminderSent: new Date()
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
      log('error', 'Failure in reactivate hosts background job.', err);
    }
    return agendaDone(err);
  });

};

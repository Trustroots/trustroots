'use strict';

/**
 * Task that collects daily statistics and sends them to Stats API
 *
 * Counted:
 * - member count
 * - push registrations enabled
 */

/**
 * Module dependencies.
 */
var async = require('async'),
    path = require('path'),
    statsService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    statistics = require(path.resolve('./modules/statistics/server/controllers/statistics.server.controller')),
    log = require(path.resolve('./config/lib/logger'));

module.exports = function (job, agendaDone) {

  async.waterfall([

    // Member count
    function (done) {

      statistics.getUsersCount(function (err, userCount) {
        if (err) {
          log('error', 'Daily statistics: failed fetching user count.', err);
          return done();
        }

        // Write number to stats
        writeDailyStat({
          namespace: 'members',
          values: {
            count: userCount
          },
          tags: {
            members: 'members'
          }
        }, done);
      });
    },

    // Get number of users who have push notifications enabled
    function (done) {
      statistics.getPushRegistrationCount(function (err, pushRegistrationCount) {
        if (err) {
          log('error', 'Daily statistics: failed fetching push registration count.', err);
          return done();
        }

        // Write number to stats
        writeDailyStat({
          namespace: 'pushRegistrations',
          values: {
            count: pushRegistrationCount
          },
          tags: {
            type: 'all'
          }
        }, done);

      });
    }

  ], function (err) {
    if (err) {
      log('error', 'Daily statistics error', err);
    }

    // Don't fail job on errors by passing `err` to `agendaDone()`
    agendaDone();
  });

};

/**
 * A helper to write to statistics, mainly to keep this job DRY by not repeating
 * all those `log()`s.
 */
function writeDailyStat(statObject, callback) {

  // Save to influx and stathat via Stats api
  statsService.stat(statObject, function (err, result) { // eslint-disable-line no-unused-vars

    // Log errors
    if (err) {
      // if there exist stat-service specific errors, log them separately
      if (err.message === 'Writing to Influx or Stathat service failed.') {
        if (err.errors && err.errors.influx) {
          log('error', 'Daily statistics: failed writing to influx', err.errors.influx);
        }
        if (err.errors && err.errors.stathat) {
          log('error', 'Daily statistics: failed writing to stathat', err.errors.stathat);
        }
      } else {
        // log a general error
        log('error', 'Daily statistics: failed writing to some endpoints.', err);
      }
    }

    // when the job fails writing to an endpoint, we probably don't want
    // to retry, because writing to the non-failing one would be duplicate
    // i.e. don't pass `err` objet to this `callback()`
    callback(null);
  });
}

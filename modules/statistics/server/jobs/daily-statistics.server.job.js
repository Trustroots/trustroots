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
            count: parseInt(userCount, 10)
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
            count: parseInt(pushRegistrationCount, 10)
          },
          tags: {
            type: 'all'
          }
        }, done);

      });
    },

    // Hosting offer count
    function (done) {

      statistics.getHostOffersCount(function (err, hostOfferCounts) {
        if (err) {
          log('error', 'Daily statistics: failed fetching hosting offer counts.', err);
          return done();
        }

        // Write numbers to stats
        async.eachSeries(hostOfferCounts, function (offerCount, doneStatus) {
          writeDailyStat({
            namespace: 'offers',
            values: {
              count: parseInt(offerCount.count, 10)
            },
            tags: {
              type: 'host',
              status: String(offerCount._id) // `yes|maybe|no`
            }
          }, doneStatus);
        }, done);

      });
    },

    // Meet offer count
    function (done) {

      statistics.getMeetOffersCount(function (err, meetOfferCount) {
        if (err) {
          log('error', 'Daily statistics: failed fetching meet count.', err);
          return done();
        }

        // Write number to stats
        writeDailyStat({
          namespace: 'offers',
          values: {
            count: parseInt(meetOfferCount, 10)
          },
          tags: {
            type: 'meet'
          }
        }, done);
      });
    },

    // Connected to networks counters
    function (done) {

      var networks = [
        'couchsurfing',
        'warmshowers',
        'bewelcome',
        'facebook',
        'twitter',
        'github'
      ];

      // Loop trough each network in series
      async.eachSeries(networks, function (networkName, doneNetwork) {
        // Get count for this network
        statistics.getExternalSiteCount(networkName, function (err, count) {
          if (err) {
            log('error', 'Daily statistics: failed fetching network "' + networkName + '" count.', err);
            return doneNetwork(err);
          }

          // Write number to stats
          writeDailyStat({
            namespace: 'membersInNetworks',
            values: {
              count: parseInt(count, 10)
            },
            tags: {
              network: networkName
            }
          }, doneNetwork);
        });
      }, done);

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

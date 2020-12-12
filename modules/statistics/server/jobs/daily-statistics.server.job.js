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
const async = require('async');
const path = require('path');
const statsService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const statistics = require(path.resolve(
  './modules/statistics/server/controllers/statistics.server.controller',
));
const log = require(path.resolve('./config/lib/logger'));

module.exports = function (job, agendaDone) {
  let totalUserCount;

  async.waterfall(
    [
      // Member count
      function (done) {
        statistics.getUsersCount(function (err, count) {
          if (err) {
            log('error', 'Daily statistics: failed fetching user count.', err);
            return done();
          }

          totalUserCount = count;

          // Write number to stats
          writeDailyStat(
            {
              namespace: 'members',
              values: {
                count,
              },
              tags: {
                members: 'members',
              },
            },
            done,
          );
        });
      },

      // Get number of users who have push notifications enabled
      function (done) {
        statistics.getPushRegistrationCount(function (err, count) {
          if (err) {
            log(
              'error',
              'Daily statistics: failed fetching push registration count.',
              err,
            );
            return done();
          }

          // Write number to stats
          writeDailyStat(
            {
              namespace: 'pushRegistrations',
              values: {
                count,
              },
              tags: {
                type: 'all',
              },
            },
            done,
          );
        });
      },

      function (done) {
        collectLastSeen(
          { days: 7 },
          'memberLastSeenPast7days',
          totalUserCount,
          done,
        );
      },

      function (done) {
        collectLastSeen(
          { days: 14 },
          'memberLastSeenPast14days',
          totalUserCount,
          done,
        );
      },

      function (done) {
        collectLastSeen(
          { days: 30 },
          'memberLastSeenPast30days',
          totalUserCount,
          done,
        );
      },

      function (done) {
        collectLastSeen(
          { months: 6 },
          'memberLastSeenPast6months',
          totalUserCount,
          done,
        );
      },

      function (done) {
        collectLastSeen(
          { months: 12 },
          'memberLastSeenPast12months',
          totalUserCount,
          done,
        );
      },

      // Hosting offer count
      function (done) {
        statistics.getHostOffersCount(function (err, hostOfferCounts) {
          if (err) {
            log(
              'error',
              'Daily statistics: failed fetching hosting offer counts.',
              err,
            );
            return done();
          }

          // Write numbers to stats
          async.eachOfSeries(
            hostOfferCounts,
            function (count, offerStatus, doneStatus) {
              writeDailyStat(
                {
                  namespace: 'offers',
                  values: {
                    count,
                    percentage: (count / totalUserCount) * 100,
                  },
                  tags: {
                    type: 'host',
                    status: String(offerStatus), // `yes|maybe|no`
                  },
                },
                doneStatus,
              );
            },
            done,
          );
        });
      },

      // Meet offer count
      function (done) {
        statistics.getMeetOffersCount(function (err, count) {
          if (err) {
            log('error', 'Daily statistics: failed fetching meet count.', err);
            return done();
          }

          // Write number to stats
          writeDailyStat(
            {
              namespace: 'offers',
              values: {
                count,
              },
              tags: {
                type: 'meet',
              },
            },
            done,
          );
        });
      },

      // Connected to networks counters
      function (done) {
        const networks = [
          'couchsurfing',
          'warmshowers',
          'bewelcome',
          'facebook',
          'twitter',
          'github',
        ];

        // Loop trough each network in series
        async.eachSeries(
          networks,
          function (networkName, doneNetwork) {
            // Get count for this network
            statistics.getExternalSiteCount(networkName, function (err, count) {
              if (err) {
                log(
                  'error',
                  'Daily statistics: failed fetching network "' +
                    networkName +
                    '" count.',
                  err,
                );
                return doneNetwork(err);
              }

              // Write number to stats
              writeDailyStat(
                {
                  namespace: 'membersInNetworks',
                  values: {
                    count,
                    percentage: (count / totalUserCount) * 100,
                  },
                  tags: {
                    network: networkName,
                  },
                },
                doneNetwork,
              );
            });
          },
          done,
        );
      },

      // Get statistics for top 40 spoken languages
      function (done) {
        statistics.getUserLanguagesCount(40, function (err, languageCounts) {
          if (err) {
            log(
              'error',
              'Daily statistics: failed fetching spoken languages counts.',
              err,
            );
            return done();
          }

          // Write numbers to stats
          async.eachOfSeries(
            languageCounts,
            function ({ _id, count }, index, doneLanguage) {
              writeDailyStat(
                {
                  namespace: 'language',
                  values: {
                    count,
                    percentage: (count / totalUserCount) * 100,
                  },
                  tags: {
                    language: _id,
                  },
                },
                doneLanguage,
              );
            },
            done,
          );
        });
      },
    ],
    function (err) {
      if (err) {
        log('error', 'Daily statistics error', err);
      }

      // Don't fail job on errors by passing `err` to `agendaDone()`
      agendaDone();
    },
  );
};

/**
 * A helper to write to statistics, mainly to keep this job DRY by not repeating
 * all those `log()`s.
 */
function writeDailyStat(statObject, callback) {
  // Save to influx and stathat via Stats api
  // eslint-disable-next-line no-unused-vars
  statsService.stat(statObject, function (err, result) {
    // Log errors
    if (err) {
      // if there exist stat-service specific errors, log them separately
      if (err.message === 'Writing to Influx or Stathat service failed.') {
        if (err.errors && err.errors.influx) {
          log(
            'error',
            'Daily statistics: failed writing to influx',
            err.errors.influx,
          );
        }
        if (err.errors && err.errors.stathat) {
          log(
            'error',
            'Daily statistics: failed writing to stathat',
            err.errors.stathat,
          );
        }
      } else {
        // log a general error
        log(
          'error',
          'Daily statistics: failed writing to some endpoints.',
          err,
        );
      }
    }

    // when the job fails writing to an endpoint, we probably don't want
    // to retry, because writing to the non-failing one would be duplicate
    // i.e. don't pass `err` objet to this `callback()`
    callback(null);
  });
}

/**
 * Collect Last Seen Stats
 */
function collectLastSeen(seenSinceDays, namespace, totalUserCount, callback) {
  statistics.getLastSeenStatistic(seenSinceDays, function (err, count) {
    if (err) {
      return callback(err);
    }
    writeDailyStat(
      {
        namespace,
        values: {
          count,
          percentage: (count / totalUserCount) * 100,
        },
        tags: {
          access: 'members',
        },
      },
      callback,
    );
  });
}

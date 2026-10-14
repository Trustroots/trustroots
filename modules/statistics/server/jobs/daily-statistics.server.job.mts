/**
 * Task that collects daily statistics and sends them to Stats API
 *
 * Counted:
 * - member count
 */

/**
 * Module dependencies.
 */
import async from 'async';
import statsService from './../../../stats/server/services/stats.server.service.mts';
import statistics from './../controllers/statistics.server.controller.mjs';
import log from './../../../../config/lib/logger.mjs';
import type { StatObject } from '../../../stats/server/services/stats.server.service.mts';
import type moment from 'moment';

type JobDone = (error?: Error | null) => void;
type WaterfallDone = (error?: unknown, ...results: unknown[]) => void;
type StatisticsService =
  typeof import('../controllers/statistics.server.controller.mts').default;
type InfluxDeliveryError = Error & {
  errors?: { influx?: unknown };
};

const statisticsService: StatisticsService = statistics;

const defaultInterop = function (_job: unknown, agendaDone: JobDone): void {
  let totalUserCount: number | undefined;
  async.waterfall(
    [
      // Member count
      function (done: WaterfallDone) {
        statisticsService.getUsersCount(function (err, count) {
          if (err) {
            logFailure('Daily statistics: failed fetching user count.', err);
            return done();
          }
          totalUserCount = count;

          // Write number to stats
          writeDailyStat(
            {
              namespace: 'members',
              values: {
                count: count!,
              },
              tags: {
                members: 'members',
              },
            },
            done,
          );
        });
      },
      // Future push: optionally count historical pushRegistration rows here
      // (previously getPushRegistrationCount → pushRegistrations measurement).

      function (done: WaterfallDone) {
        collectLastSeen(
          {
            days: 7,
          },
          'memberLastSeenPast7days',
          totalUserCount,
          done,
        );
      },
      function (done: WaterfallDone) {
        collectLastSeen(
          {
            days: 14,
          },
          'memberLastSeenPast14days',
          totalUserCount,
          done,
        );
      },
      function (done: WaterfallDone) {
        collectLastSeen(
          {
            days: 30,
          },
          'memberLastSeenPast30days',
          totalUserCount,
          done,
        );
      },
      function (done: WaterfallDone) {
        collectLastSeen(
          {
            months: 6,
          },
          'memberLastSeenPast6months',
          totalUserCount,
          done,
        );
      },
      function (done: WaterfallDone) {
        collectLastSeen(
          {
            months: 12,
          },
          'memberLastSeenPast12months',
          totalUserCount,
          done,
        );
      },
      // Hosting offer count
      function (done: WaterfallDone) {
        statisticsService.getHostOffersCount(function (err, hostOfferCounts) {
          if (err) {
            logFailure(
              'Daily statistics: failed fetching hosting offer counts.',
              err,
            );
            return done();
          }

          // Write numbers to stats
          async.eachOfSeries(
            hostOfferCounts!,
            function (count, offerStatus, doneStatus) {
              writeDailyStat(
                {
                  namespace: 'offers',
                  values: {
                    count,
                    percentage: (count / totalUserCount!) * 100,
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
      function (done: WaterfallDone) {
        statisticsService.getMeetOffersCount(function (err, count) {
          if (err) {
            logFailure('Daily statistics: failed fetching meet count.', err);
            return done();
          }

          // Write number to stats
          writeDailyStat(
            {
              namespace: 'offers',
              values: {
                count: count!,
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
      function (done: WaterfallDone) {
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
            statisticsService.getExternalSiteCount(
              networkName,
              function (err, count) {
                if (err) {
                  logFailure(
                    'Daily statistics: failed fetching network "' +
                      networkName +
                      '" count.',
                    err,
                  );
                  return doneNetwork(err as Error);
                }

                // Write number to stats
                writeDailyStat(
                  {
                    namespace: 'membersInNetworks',
                    values: {
                      count: count!,
                      percentage: (count! / totalUserCount!) * 100,
                    },
                    tags: {
                      network: networkName,
                    },
                  },
                  doneNetwork,
                );
              },
            );
          },
          done,
        );
      },
      // Get statistics for top 40 spoken languages
      function (done: WaterfallDone) {
        statisticsService.getUserLanguagesCount(
          40,
          function (err, languageCounts) {
            if (err) {
              logFailure(
                'Daily statistics: failed fetching spoken languages counts.',
                err,
              );
              return done();
            }

            // Write numbers to stats
            async.eachOfSeries(
              languageCounts!,
              function ({ _id, count }, index, doneLanguage) {
                writeDailyStat(
                  {
                    namespace: 'language',
                    values: {
                      count,
                      percentage: (count / totalUserCount!) * 100,
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
          },
        );
      },
    ],
    function (err?: Error | null) {
      if (err) {
        logFailure('Daily statistics error', err);
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
function writeDailyStat(statObject: StatObject, callback: JobDone): void {
  // Save to influx via Stats api
  statsService.deliver(statObject, function (err) {
    // Log errors
    if (err) {
      const deliveryError = err as InfluxDeliveryError;
      // if there exist stat-service specific errors, log them separately
      if (deliveryError.message === 'Writing to Influx service failed.') {
        if (deliveryError.errors && deliveryError.errors.influx) {
          logFailure(
            'Daily statistics: failed writing to influx',
            deliveryError.errors.influx,
          );
        }
      } else {
        // log a general error
        logFailure('Daily statistics: failed writing to some endpoints.', err);
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
function collectLastSeen(
  seenSinceDays: moment.DurationInputArg1,
  namespace: string,
  totalUserCount: number | undefined,
  callback: JobDone,
): void {
  statisticsService.getLastSeenStatistic(seenSinceDays, function (err, count) {
    if (err) {
      return callback(err as Error);
    }
    writeDailyStat(
      {
        namespace,
        values: {
          count: count!,
          percentage: (count! / totalUserCount!) * 100,
        },
        tags: {
          access: 'members',
        },
      },
      callback,
    );
  });
}
export default defaultInterop;
export { defaultInterop as 'module.exports' };

function logFailure(message: string, error: unknown): void {
  // The legacy logger accepts arbitrary metadata; its inferred JS signature
  // is narrower than the values passed at these existing call sites.
  log('error', message, error as Record<string, unknown>);
}

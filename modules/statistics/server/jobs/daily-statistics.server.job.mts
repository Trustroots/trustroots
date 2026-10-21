/**
 * Task that collects daily statistics and sends them to Stats API
 *
 * Counted:
 * - member count
 */

/**
 * Module dependencies.
 */
import statsService from './../../../stats/server/services/stats.server.service.mts';
import statistics from './../controllers/statistics.server.controller.mjs';
import log from './../../../../config/lib/logger.mjs';
import type { StatObject } from '../../../stats/server/services/stats.server.service.mts';
import type moment from 'moment';

type JobDone = (error?: Error | null) => void;
type StatisticsService =
  typeof import('../controllers/statistics.server.controller.mts').default;
type InfluxDeliveryError = Error & {
  errors?: { influx?: unknown };
};

const statisticsService: StatisticsService = statistics;

const defaultInterop = function (_job: unknown, agendaDone: JobDone): void {
  collectDailyStatistics().then(
    function () {
      agendaDone();
    },
    function (err: Error) {
      logFailure('Daily statistics error', err);

      // Don't fail job on errors by passing `err` to `agendaDone()`
      agendaDone();
    },
  );
};

async function collectDailyStatistics(): Promise<void> {
  let totalUserCount: number | undefined;

  // Member count
  await fromCallback<number>(function (callback) {
    statisticsService.getUsersCount(callback);
  }).then(
    async function (count) {
      totalUserCount = count;

      // Write number to stats
      await writeDailyStat({
        namespace: 'members',
        values: {
          count: count!,
        },
        tags: {
          members: 'members',
        },
      });
    },
    function (err) {
      logFailure('Daily statistics: failed fetching user count.', err);
    },
  );
  // Future push: optionally count historical pushRegistration rows here
  // (previously getPushRegistrationCount → pushRegistrations measurement).

  await collectLastSeen(
    {
      days: 7,
    },
    'memberLastSeenPast7days',
    totalUserCount,
  );
  await collectLastSeen(
    {
      days: 14,
    },
    'memberLastSeenPast14days',
    totalUserCount,
  );
  await collectLastSeen(
    {
      days: 30,
    },
    'memberLastSeenPast30days',
    totalUserCount,
  );
  await collectLastSeen(
    {
      months: 6,
    },
    'memberLastSeenPast6months',
    totalUserCount,
  );
  await collectLastSeen(
    {
      months: 12,
    },
    'memberLastSeenPast12months',
    totalUserCount,
  );

  // Hosting offer count
  await fromCallback<Record<string, number>>(function (callback) {
    statisticsService.getHostOffersCount(callback);
  }).then(
    async function (hostOfferCounts) {
      // Write numbers to stats
      for (const [offerStatus, count] of Object.entries(hostOfferCounts!)) {
        await writeDailyStat({
          namespace: 'offers',
          values: {
            count,
            percentage: (count / totalUserCount!) * 100,
          },
          tags: {
            type: 'host',
            status: offerStatus, // `yes|maybe|no`
          },
        });
      }
    },
    function (err) {
      logFailure(
        'Daily statistics: failed fetching hosting offer counts.',
        err,
      );
    },
  );

  // Meet offer count
  await fromCallback<number>(function (callback) {
    statisticsService.getMeetOffersCount(callback);
  }).then(
    async function (count) {
      // Write number to stats
      await writeDailyStat({
        namespace: 'offers',
        values: {
          count: count!,
        },
        tags: {
          type: 'meet',
        },
      });
    },
    function (err) {
      logFailure('Daily statistics: failed fetching meet count.', err);
    },
  );

  // Connected to networks counters
  const networks = [
    'couchsurfing',
    'warmshowers',
    'bewelcome',
    'facebook',
    'twitter',
    'github',
  ];

  // Loop trough each network in series
  for (const networkName of networks) {
    // Get count for this network
    let count: number | undefined;
    try {
      count = await fromCallback<number>(function (callback) {
        statisticsService.getExternalSiteCount(networkName, callback);
      });
    } catch (err) {
      logFailure(
        'Daily statistics: failed fetching network "' +
          networkName +
          '" count.',
        err,
      );
      throw err;
    }

    // Write number to stats
    await writeDailyStat({
      namespace: 'membersInNetworks',
      values: {
        count: count!,
        percentage: (count! / totalUserCount!) * 100,
      },
      tags: {
        network: networkName,
      },
    });
  }

  // Get statistics for top 40 spoken languages
  await fromCallback<Array<{ _id: string; count: number }>>(
    function (callback) {
      statisticsService.getUserLanguagesCount(40, callback);
    },
  ).then(
    async function (languageCounts) {
      // Write numbers to stats
      for (const { _id, count } of languageCounts!) {
        await writeDailyStat({
          namespace: 'language',
          values: {
            count,
            percentage: (count / totalUserCount!) * 100,
          },
          tags: {
            language: _id,
          },
        });
      }
    },
    function (err) {
      logFailure(
        'Daily statistics: failed fetching spoken languages counts.',
        err,
      );
    },
  );
}

function fromCallback<Value>(
  run: (callback: (err: unknown, value?: Value) => void) => void,
): Promise<Value | undefined> {
  return new Promise(function (resolve, reject) {
    run(function (err, value) {
      if (err) return reject(err);
      resolve(value);
    });
  });
}

/**
 * A helper to write to statistics, mainly to keep this job DRY by not repeating
 * all those `log()`s.
 */
function writeDailyStat(statObject: StatObject): Promise<void> {
  return new Promise(function (resolve) {
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
          logFailure(
            'Daily statistics: failed writing to some endpoints.',
            err,
          );
        }
      }

      // when the job fails writing to an endpoint, we probably don't want
      // to retry, because writing to the non-failing one would be duplicate
      // i.e. don't reject here
      resolve();
    });
  });
}

/**
 * Collect Last Seen Stats
 */
async function collectLastSeen(
  seenSinceDays: moment.DurationInputArg1,
  namespace: string,
  totalUserCount: number | undefined,
): Promise<void> {
  const count = await fromCallback<number>(function (callback) {
    statisticsService.getLastSeenStatistic(seenSinceDays, callback);
  });
  await writeDailyStat({
    namespace,
    values: {
      count: count!,
      percentage: (count! / totalUserCount!) * 100,
    },
    tags: {
      access: 'members',
    },
  });
}
export default defaultInterop;
export { defaultInterop as 'module.exports' };

function logFailure(message: string, error: unknown): void {
  // The legacy logger accepts arbitrary metadata; its inferred JS signature
  // is narrower than the values passed at these existing call sites.
  log('error', message, error as Record<string, unknown>);
}

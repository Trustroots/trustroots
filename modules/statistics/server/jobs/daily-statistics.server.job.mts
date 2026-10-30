/**
 * Task that collects daily statistics and sends them to Stats API
 *
 * Counted:
 * - member count
 */

/**
 * Module dependencies.
 */
import { promisify } from 'node:util';
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
  async function collect(): Promise<void> {
    let totalUserCount: number | undefined;
    try {
      totalUserCount = await promisify(statisticsService.getUsersCount)();
    } catch (err) {
      logFailure('Daily statistics: failed fetching user count.', err);
    }
    if (totalUserCount !== undefined) {
      await promisify(writeDailyStat)({
        namespace: 'members',
        values: { count: totalUserCount },
        tags: { members: 'members' },
      });
    }
    for (const [period, namespace] of [
      [{ days: 7 }, 'memberLastSeenPast7days'],
      [{ days: 14 }, 'memberLastSeenPast14days'],
      [{ days: 30 }, 'memberLastSeenPast30days'],
      [{ months: 6 }, 'memberLastSeenPast6months'],
      [{ months: 12 }, 'memberLastSeenPast12months'],
    ] as const) {
      await promisify(collectLastSeen)(period, namespace, totalUserCount);
    }
    let hostOfferCounts: { yes: number; maybe: number; no: number } | undefined;
    try {
      hostOfferCounts = await promisify(statisticsService.getHostOffersCount)();
    } catch (err) {
      logFailure(
        'Daily statistics: failed fetching hosting offer counts.',
        err,
      );
    }
    if (hostOfferCounts) {
      for (const [status, count] of Object.entries(hostOfferCounts)) {
        await promisify(writeDailyStat)({
          namespace: 'offers',
          values: { count, percentage: (count / totalUserCount!) * 100 },
          tags: { type: 'host', status },
        });
      }
    }
    let meetCount: number | undefined;
    try {
      meetCount = await promisify(statisticsService.getMeetOffersCount)();
    } catch (err) {
      logFailure('Daily statistics: failed fetching meet count.', err);
    }
    if (meetCount !== undefined) {
      await promisify(writeDailyStat)({
        namespace: 'offers',
        values: { count: meetCount },
        tags: { type: 'meet' },
      });
    }
    for (const network of [
      'couchsurfing',
      'warmshowers',
      'bewelcome',
      'facebook',
      'twitter',
      'github',
    ]) {
      let count: number;
      try {
        count = (await promisify(statisticsService.getExternalSiteCount)(
          network,
        ))!;
      } catch (err) {
        logFailure(
          'Daily statistics: failed fetching network "' + network + '" count.',
          err,
        );
        throw err;
      }
      await promisify(writeDailyStat)({
        namespace: 'membersInNetworks',
        values: { count, percentage: (count / totalUserCount!) * 100 },
        tags: { network },
      });
    }
    let languageCounts: Array<{ _id: string; count: number }> | undefined;
    try {
      languageCounts = await promisify(statisticsService.getUserLanguagesCount)(
        40,
      );
    } catch (err) {
      logFailure(
        'Daily statistics: failed fetching spoken languages counts.',
        err,
      );
    }
    if (languageCounts) {
      for (const { _id, count } of languageCounts) {
        await promisify(writeDailyStat)({
          namespace: 'language',
          values: { count, percentage: (count / totalUserCount!) * 100 },
          tags: { language: _id },
        });
      }
    }
  }
  collect().then(
    () => agendaDone(),
    err => {
      logFailure('Daily statistics error', err);
      // Retrying would duplicate writes to endpoints that succeeded.
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

function logFailure(message: string, error: unknown): void {
  // The legacy logger accepts arbitrary metadata; its inferred JS signature
  // is narrower than the values passed at these existing call sites.
  log('error', message, error as Record<string, unknown>);
}

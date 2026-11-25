import type { Job, Agenda } from 'agenda';
import { registerWorkerJobs } from '../../layers/server/worker-jobs.mts';
import { agendaLockLifetime } from './agenda-lock.mts';
import config from '../config.mts';
import dependency1 from 'util';
import statService from './../../modules/stats/server/services/stats.server.service.mts';
import dependency3 from 'mongodb';
interface WorkerOptions {
  maxAttempts: number;
  retryDelaySeconds: number;
}
type Done = (error?: Error | null) => void;
const gracefulShutdownTimeoutMs = 30_000;
const service = {
  start,
  unlockAgendaJobs,
  removeExitListeners,
  scheduleRetry,
  gracefulExit,
};
const format = dependency1.format;
const MongoClient = dependency3.MongoClient;
let agenda: Agenda;

async function start(options: WorkerOptions, callback?: Done) {
  // Initialise Agenda inside `start()` so importing worker helpers does not
  // open a database connection.
  ({ default: agenda } = await import('./agenda.mts'));
  const scheduleJobs = await registerWorkerJobs(agenda);
  const startPromise = agenda
    .start()
    .then(scheduleJobs)
    .then(function () {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Worker] Agenda started processing background jobs');
      }
    });
  if (callback) {
    startPromise.then(
      function () {
        callback();
      },
      function (err) {
        callback(err);
      },
    );
  }

  // Log finished jobs
  agenda.on('success', function (job: Job) {
    if (process.env.NODE_ENV !== 'test') {
      const statsObject = {
        namespace: 'agendaJob',
        counts: {
          count: 1,
        },
        tags: {
          name: job.attrs.name,
          status: 'success',
          failCount: job.attrs.failCount || 0,
        },
      };

      // Send job failure to stats servers
      statService.stat(statsObject, function () {
        // Log also to console
        if (process.env.NODE_ENV !== 'test') {
          console.log(
            '[Worker] Agenda job [%s] %s finished.',
            job.attrs.name,
            job.attrs._id,
          );
        }
      });
    }
  });

  // Error reporting and retry logic
  agenda.on('fail', function (err: Error, job: Job) {
    let extraMessage = '';
    const nextRunAt = scheduleRetry(err, job, options);
    if (shouldRetry(err) && job.attrs.failCount! >= options.maxAttempts) {
      extraMessage = format('too many failures, giving up');
    } else if (nextRunAt) {
      extraMessage = format(
        'will retry in %s seconds at %s',
        options.retryDelaySeconds,
        nextRunAt.toISOString(),
      );
    }
    const statsObject = {
      namespace: 'agendaJob',
      counts: {
        count: 1,
      },
      tags: {
        name: job.attrs.name,
        status: 'failed',
        failCount: job.attrs.failCount || 0,
      },
    };

    // Send job failure to stats servers
    statService.stat(statsObject, function () {
      // Log also to console

      if (process.env.NODE_ENV !== 'test') {
        console.error(
          '[Worker] Agenda job [%s] %s failed with [%s] %s failCount:%s',
          job.attrs.name,
          job.attrs._id,
          err.message || 'Unknown error',
          extraMessage,
          job.attrs.failCount,
        );
      }
    });
  });

  // Gracefully exit Agenda
  addExitListeners();
  return startPromise;
}

/**
 * Attempt to unlock Agenda jobs that were stuck due server restart
 * See https://github.com/agenda/agenda/issues/410
 */
function unlockAgendaJobs(callback: Done) {
  if (process.env.NODE_ENV !== 'test') {
    console.log('[Worker] Attempting to unlock locked Agenda jobs...');
  }

  // Use connect method to connect to the server
  MongoClient.connect(config.db.uri)
    .then(function (client) {
      const agendaJobs = client.db().collection('agendaJobs');
      return agendaJobs
        .updateMany(
          {
            lockedAt: { $lte: new Date(Date.now() - agendaLockLifetime) },
            lastFinishedAt: null,
          },
          {
            $unset: {
              lockedAt: '',
              lastModifiedBy: '',
              lastRunAt: '',
            },
            $set: {
              nextRunAt: new Date(),
            },
          },
        )
        .then(
          function (result) {
            if (process.env.NODE_ENV !== 'test') {
              console.log(
                '[Worker] Unlocked %d Agenda jobs.',
                result?.modifiedCount || 0,
              );
            }
            return client.close().then(
              function () {
                callback();
              },
              function (closeErr) {
                callback(closeErr);
              },
            );
          },
          function (err) {
            console.error(err);
            return client.close().then(
              function () {
                callback(err);
              },
              function () {
                callback(err);
              },
            );
          },
        );
    })
    .catch(function (err) {
      console.error(err);
      callback(err);
    });
}

/**
 * Used for testing
 */
function removeExitListeners() {
  process.removeListener('SIGTERM', gracefulExit);
  process.removeListener('SIGINT', gracefulExit);
}

/**
 * Adds listeners to allow Agenda exit gracefully
 */
function addExitListeners() {
  process.on('SIGTERM', gracefulExit);
  process.on('SIGINT', gracefulExit);
}

/**
 * Gracefully exit Agenda
 */
function gracefulExit() {
  console.log('[Worker] Draining Agenda jobs...');
  return agenda
    .drain(gracefulShutdownTimeoutMs)
    .then(function (result) {
      if (result.timedOut) {
        console.error(
          '[Worker] Agenda drain timed out with %d running job(s).',
          result.running,
        );
      }
      return agenda.stop().then(function () {
        return result.timedOut ? 1 : 0;
      });
    })
    .then(function (exitCode) {
      console.log('[Worker] Agenda stopped.');
      process.exit(exitCode);
    })
    .catch(function (err) {
      console.error('[Worker] Could not stop Agenda cleanly.', err);
      process.exit(1);
    });
}
function shouldRetry(err: Error) {
  // Retry on connection errors as they may just be temporary
  if (/(ECONNRESET|ECONNREFUSED)/.test(err.message)) {
    return true;
  }
  return false;
}

/**
 * Schedule network failures on the current job. Agenda persists this schedule
 * together with processor-owned failure state after the fail event completes.
 */
function scheduleRetry(
  err: Error,
  job: Job,
  options: WorkerOptions,
): Date | undefined {
  if (job.attrs.failCount! >= options.maxAttempts || !shouldRetry(err)) {
    return undefined;
  }

  const nextRunAt = secondsFromNowDate(options.retryDelaySeconds);
  job.schedule(nextRunAt);
  return nextRunAt;
}

function secondsFromNowDate(seconds: number) {
  return new Date(new Date().getTime() + seconds * 1000);
}
export default service;

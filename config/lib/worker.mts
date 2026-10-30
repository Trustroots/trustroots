import type { Job, Agenda } from 'agenda';
import { agendaLockLifetime } from './agenda-lock.mts';
import config from './../config.mts';
import dependency1 from 'util';
import statService from './../../modules/stats/server/services/stats.server.service.mts';
import dependency3 from 'mongodb';
interface WorkerOptions {
  maxAttempts: number;
  retryDelaySeconds: number;
}
type Done = (error?: Error | null) => void;
const gracefulShutdownTimeoutMs = 30_000;
type JobDefinitionOptions = {
  priority?: number | 'lowest' | 'low' | 'normal' | 'high' | 'highest';
  concurrency?: number;
  lockLifetime?: number;
};
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

function defineJob<Data>(
  name: string,
  processor: (job: Job<Data>, done: Done) => unknown,
  options: JobDefinitionOptions = {},
) {
  agenda.define<Data>(
    name,
    (job, done) => {
      processor(job, done as Done);
    },
    options,
  );
}

async function start(options: WorkerOptions, callback?: Done) {
  // Initialise Agenda inside `start()` so importing worker helpers does not
  // open a database connection.
  ({ default: agenda } = await import('./agenda.mjs'));
  const { default: dependency4 } =
    await import('./../../modules/core/server/jobs/send-email.server.job.mjs');
  const { default: dependency5 } =
    await import('./../../modules/messages/server/jobs/message-unread.server.job.mjs');
  const { default: dependency6 } =
    await import('./../../modules/statistics/server/jobs/daily-statistics.server.job.mjs');
  const { default: dependency7 } =
    await import('./../../modules/users/server/jobs/user-finish-signup.server.job.mjs');
  const { default: dependency8 } =
    await import('./../../modules/offers/server/jobs/reactivate-hosts.server.job.mjs');
  const { default: dependency9 } =
    await import('./../../modules/users/server/jobs/user-welcome-sequence-first.server.job.mjs');
  const { default: dependency10 } =
    await import('./../../modules/users/server/jobs/user-welcome-sequence-second.server.job.mjs');
  const { default: dependency11 } =
    await import('./../../modules/users/server/jobs/user-welcome-sequence-third.server.job.mjs');
  const { default: dependency12 } =
    await import('./../../modules/experiences/server/jobs/experiences-publish.server.job.mjs');
  const { sendSupportMessage: supportMessageJob } =
    await import('./../../modules/support/server/jobs/send-support-message.server.job.mts');
  const { pollSupportMailbox: pollSupportMailboxJob } =
    await import('./../../modules/support/server/jobs/poll-support-mailbox.server.job.mts');
  const { recoverSupportMessages: recoverSupportMessagesJob } =
    await import('./../../modules/support/server/jobs/recover-support-messages.server.job.mts');

  // Define jobs

  defineJob('send email', dependency4, {
    priority: 'high',
    concurrency: 10,
  });

  // Future push: re-register a delivery job here (previously
  // `send push message` via modules/core/server/jobs/send-push-message).

  defineJob('check unread messages', dependency5, {
    lockLifetime: 10000,
  });
  defineJob('daily statistics', dependency6, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('send signup reminders', dependency7, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('reactivate hosts', dependency8, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('welcome sequence first', dependency9, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('welcome sequence second', dependency10, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('welcome sequence third', dependency11, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('publish expired experiences', dependency12, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('send support message', supportMessageJob, {
    priority: 'high',
    concurrency: 2,
    lockLifetime: 60000,
  });
  defineJob('poll support mailbox', pollSupportMailboxJob, {
    concurrency: 1,
    lockLifetime: 120000,
  });
  defineJob('recover support messages', recoverSupportMessagesJob, {
    concurrency: 1,
    lockLifetime: 120000,
  });
  const startPromise = agenda
    .start()
    .then(function () {
      return Promise.all([
        agenda.every('5 minutes', 'check unread messages'),
        agenda.every('24 hours', 'daily statistics'),
        agenda.every('30 minutes', 'send signup reminders'),
        agenda.every('30 minutes', 'reactivate hosts'),
        agenda.every('15 minutes', 'welcome sequence first'),
        agenda.every('60 minutes', 'welcome sequence second'),
        agenda.every('60 minutes', 'welcome sequence third'),
        agenda.every('23 minutes', 'publish expired experiences'),
        ...(config.supportInbox.enabled && config.supportInbox.imap.enabled
          ? [
              agenda.every(
                `${config.supportInbox.imap.pollIntervalMinutes} minutes`,
                'poll support mailbox',
              ),
            ]
          : []),
        ...(config.supportInbox.enabled
          ? [agenda.every('1 minute', 'recover support messages')]
          : []),
      ]);
    })
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
/** @commonjs */
export { service as 'module.exports' };

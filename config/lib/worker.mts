import type { Job } from 'agenda';
import type { RuntimeAgenda } from './agenda.mts';
import config from './../config.mts';
import dependency1 from 'util';
import statService from './../../modules/stats/server/services/stats.server.service.mts';
import dependency3 from 'mongodb';
export interface WorkerOptions {
  maxAttempts: number;
  retryDelaySeconds: number;
}
type Done = (error?: Error | null) => void;
const service = { start, unlockAgendaJobs, removeExitListeners };
const format = dependency1.format;
const MongoClient = dependency3.MongoClient;
let agenda: RuntimeAgenda;
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

  agenda.define(
    'send email',
    {
      priority: 'high',
      concurrency: 10,
    },
    dependency4,
  );

  // Future push: re-register a delivery job here (previously
  // `send push message` via modules/core/server/jobs/send-push-message).

  agenda.define(
    'check unread messages',
    {
      lockLifetime: 10000,
    },
    dependency5,
  );
  agenda.define(
    'daily statistics',
    {
      lockLifetime: 10000,
      concurrency: 1,
    },
    dependency6,
  );
  agenda.define(
    'send signup reminders',
    {
      lockLifetime: 10000,
      concurrency: 1,
    },
    dependency7,
  );
  agenda.define(
    'reactivate hosts',
    {
      lockLifetime: 10000,
      concurrency: 1,
    },
    dependency8,
  );
  agenda.define(
    'welcome sequence first',
    {
      lockLifetime: 10000,
      concurrency: 1,
    },
    dependency9,
  );
  agenda.define(
    'welcome sequence second',
    {
      lockLifetime: 10000,
      concurrency: 1,
    },
    dependency10,
  );
  agenda.define(
    'welcome sequence third',
    {
      lockLifetime: 10000,
      concurrency: 1,
    },
    dependency11,
  );
  agenda.define(
    'publish expired experiences',
    {
      lockLifetime: 10000,
      concurrency: 1,
    },
    dependency12,
  );
  agenda.define(
    'send support message',
    { priority: 'high', concurrency: 2, lockLifetime: 60000 },
    supportMessageJob,
  );
  agenda.define(
    'poll support mailbox',
    { concurrency: 1, lockLifetime: 120000 },
    pollSupportMailboxJob,
  );
  agenda.define(
    'recover support messages',
    { concurrency: 1, lockLifetime: 120000 },
    recoverSupportMessagesJob,
  );
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
    if (job.attrs.failCount! >= options.maxAttempts) {
      extraMessage = format('too many failures, giving up');
    } else if (shouldRetry(err)) {
      job.attrs.nextRunAt = secondsFromNowDate(options.retryDelaySeconds);
      extraMessage = format(
        'will retry in %s seconds at %s',
        options.retryDelaySeconds,
        job.attrs.nextRunAt.toISOString(),
      );
      Promise.resolve(job.save()).catch(function (saveError) {
        console.error('[Worker] Failed to save job retry', saveError);
      });
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
            lockedAt: {
              $exists: true,
            },
            lastFinishedAt: {
              $exists: false,
            },
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
  console.log('[Worker] Stopping Agenda...');
  agenda
    .stop()
    .then(function () {
      console.log('[Worker] Agenda stopped.');
      process.exit(0);
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
function secondsFromNowDate(seconds: number) {
  return new Date(new Date().getTime() + seconds * 1000);
}
export default service;
export { service as 'module.exports' };

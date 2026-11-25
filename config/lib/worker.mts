import type { Job, Agenda } from 'agenda';
import { agendaLockLifetime } from './agenda-lock.mts';
import { pruneAgendaDeliveryJobs } from './agenda-retention.mts';
import config, { mailMode } from './../config.mts';
import {
  deploymentNotificationHandler,
  deploymentNotificationJob,
} from './deployment-notifications.mts';
import dependency1 from 'util';
import statService from './../../modules/stats/server/services/stats.server.service.mts';
import dependency3 from 'mongodb';
import mongoose from 'mongoose';
interface WorkerOptions {
  maxAttempts: number;
  retryDelaySeconds: number;
}
type Done = (error?: Error | null) => void;
const gracefulShutdownTimeoutMs = 30_000;
const pruneAgendaDeliveryJobsName = 'prune agenda delivery jobs';
type JobDefinitionOptions = {
  priority?: number | 'lowest' | 'low' | 'normal' | 'high' | 'highest';
  concurrency?: number;
  lockLifetime?: number;
  removeOnComplete?: boolean;
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
  if (typeof processor !== 'function') {
    throw new TypeError(`Agenda job "${name}" has no handler`);
  }
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
  ({ default: agenda } = await import('./agenda.mts'));
  const { default: sendEmailJob } =
    await import('./../../modules/core/server/jobs/send-email.server.job.mts');
  const { default: unreadMessagesJob } =
    await import('./../../modules/messages/server/jobs/message-unread.server.job.mts');
  const { default: dailyStatisticsJob } =
    await import('./../../modules/statistics/server/jobs/daily-statistics.server.job.mts');
  const { default: signupRemindersJob } =
    await import('./../../modules/users/server/jobs/user-finish-signup.server.job.mts');
  const { sendSignupReminderJob } =
    await import('../../modules/users/server/services/signup-reminder.server.service.mts');
  const { default: reactivateHostsJob } =
    await import('./../../modules/offers/server/jobs/reactivate-hosts.server.job.mts');
  const { default: welcomeSequenceFirstJob } =
    await import('./../../modules/users/server/jobs/user-welcome-sequence-first.server.job.mts');
  const { default: welcomeSequenceSecondJob } =
    await import('./../../modules/users/server/jobs/user-welcome-sequence-second.server.job.mts');
  const { default: welcomeSequenceThirdJob } =
    await import('./../../modules/users/server/jobs/user-welcome-sequence-third.server.job.mts');
  const { default: publishExperiencesJob } =
    await import('./../../modules/experiences/server/jobs/experiences-publish.server.job.mts');
  const {
    queueExperienceReplyReminders,
    queueExperienceReplyRemindersJob,
    sendExperienceReplyReminder,
    sendExperienceReplyReminderJob,
  } =
    await import('../../modules/experiences/server/jobs/experience-reply-reminder.server.job.mts');
  const { sendSupportMessage: supportMessageJob } =
    await import('./../../modules/support/server/jobs/send-support-message.server.job.mts');
  const { pollSupportMailbox: pollSupportMailboxJob } =
    await import('./../../modules/support/server/jobs/poll-support-mailbox.server.job.mts');
  const { recoverSupportMessages: recoverSupportMessagesJob } =
    await import('./../../modules/support/server/jobs/recover-support-messages.server.job.mts');

  const { deliverMessagePush, messagePushJobName } =
    await import('../../modules/messages/server/jobs/message-push.server.job.mts');
  const { deliverTest, testPushJobName } =
    await import('../../modules/users/server/services/unified-push.server.service.mts');

  const { captureAgendaStorage, captureAgendaStorageJob } =
    await import('../../modules/admin/server/services/agenda-storage.server.service.mts');

  const { captureAgendaInventory } =
    await import('../../modules/admin/server/services/agenda-inventory.server.service.mts');

  const { queueMessageDigests } =
    await import('../../modules/messages/server/jobs/message-digest.server.job.mts');
  const messageDigestJobName = 'queue unread message digests';

  // Define jobs

  agenda.define(
    pruneAgendaDeliveryJobsName,
    async () => {
      const deleted = await pruneAgendaDeliveryJobs(
        mongoose.connection.db!.collection('agendaJobs'),
      );
      if (deleted > 0) {
        console.log(
          '[Worker] Pruned %d terminal Agenda delivery jobs.',
          deleted,
        );
      }
    },
    { concurrency: 1, lockLifetime: 30 * 60 * 1000 },
  );

  agenda.define(
    captureAgendaStorageJob,
    async () => {
      // The worker connects Mongoose before registering Agenda jobs.
      const db = mongoose.connection.db!;
      await captureAgendaStorage(db);
      await captureAgendaInventory(db);
    },
    { concurrency: 1 },
  );

  defineJob('send email', sendEmailJob, {
    priority: 'high',
    concurrency: 10,
  });
  defineJob(
    deploymentNotificationJob,
    deploymentNotificationHandler(config.domain, mailMode, sendEmailJob),
    { priority: 'high', concurrency: 10 },
  );

  defineJob(sendSignupReminderJob, sendEmailJob, {
    priority: 'high',
    concurrency: 10,
    removeOnComplete: true,
  });

  agenda.define<Parameters<typeof deliverMessagePush>[0]>(
    messagePushJobName,
    async job => {
      if (job.attrs.data) await deliverMessagePush(job.attrs.data);
    },
    { priority: 'high', removeOnComplete: true },
  );
  agenda.define<Parameters<typeof deliverTest>[0]>(
    testPushJobName,
    async job => {
      if (job.attrs.data) await deliverTest(job.attrs.data);
    },
    { priority: 'high', removeOnComplete: true },
  );

  agenda.define(messageDigestJobName, async () => queueMessageDigests(), {
    concurrency: 1,
    lockLifetime: 60000,
  });
  defineJob('check unread messages', unreadMessagesJob, {
    lockLifetime: 10000,
  });
  defineJob('daily statistics', dailyStatisticsJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('send signup reminders', signupRemindersJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('reactivate hosts', reactivateHostsJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('welcome sequence first', welcomeSequenceFirstJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('welcome sequence second', welcomeSequenceSecondJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('welcome sequence third', welcomeSequenceThirdJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob('publish expired experiences', publishExperiencesJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  agenda.define(
    queueExperienceReplyRemindersJob,
    async () => queueExperienceReplyReminders(agenda),
    { concurrency: 1, lockLifetime: 120000 },
  );
  agenda.define(sendExperienceReplyReminderJob, sendExperienceReplyReminder, {
    concurrency: 2,
    lockLifetime: 60000,
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
        agenda.every('5 minutes', 'queue unread message digests'),
        agenda.every('24 hours', 'daily statistics'),
        agenda.every('*/15 * * * *', pruneAgendaDeliveryJobsName, undefined, {
          timezone: 'UTC',
        }),
        agenda.every('0 3 * * *', captureAgendaStorageJob, undefined, {
          timezone: 'UTC',
        }),
        agenda.every('30 minutes', 'send signup reminders'),
        agenda.every('30 minutes', 'reactivate hosts'),
        agenda.every('15 minutes', 'welcome sequence first'),
        agenda.every('60 minutes', 'welcome sequence second'),
        agenda.every('60 minutes', 'welcome sequence third'),
        agenda.every('23 minutes', 'publish expired experiences'),
        agenda.every('30 minutes', queueExperienceReplyRemindersJob),
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

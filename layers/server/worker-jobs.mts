import { sendSignupReminderJob } from '../../modules/core/server/services/signup-reminder-mail.server.contract.mts';
import type { Agenda, Job } from 'agenda';
import { pruneAgendaDeliveryJobs } from '../../config/lib/agenda-retention.mts';
import config, { mailMode } from '../../config/config.mts';
import {
  deploymentNotificationHandler,
  deploymentNotificationJob,
} from '../../config/lib/deployment-notifications.mts';
import mongoose from 'mongoose';
import admin from '../../modules/admin/server/worker-entry.mts';
import core from '../../modules/core/server/worker-entry.mts';
import experiences from '../../modules/experiences/server/worker-entry.mts';
import messages from '../../modules/messages/server/worker-entry.mts';
import offers from '../../modules/offers/server/worker-entry.mts';
import statistics from '../../modules/statistics/server/worker-entry.mts';
import support from '../../modules/support/server/worker-entry.mts';
import users from '../../modules/users/server/worker-entry.mts';

type Done = (error?: Error | null) => void;
const pruneAgendaDeliveryJobsName = 'prune agenda delivery jobs';
type JobDefinitionOptions = {
  priority?: number | 'lowest' | 'low' | 'normal' | 'high' | 'highest';
  concurrency?: number;
  lockLifetime?: number;
  removeOnComplete?: boolean;
};

function defineJob<Data>(
  agenda: Agenda,
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

export async function registerWorkerJobs(agenda: Agenda) {
  const { default: createSendEmailJob } = await core.sendEmail();
  const { canDeliverNotificationEmail } = await users.notificationEmail();
  const { deliverSignupReminder } = await users.signupReminderDelivery();
  const sendEmailJob = createSendEmailJob({
    canDeliverNotificationEmail,
    deliverSignupReminder,
  });
  const { default: unreadMessagesJob } = await messages.unreadMessages();
  const { default: dailyStatisticsJob } = await statistics.dailyStatistics();
  const { default: signupRemindersJob } = await users.signupReminders();
  const { default: reactivateHostsJob } = await offers.reactivateHosts();
  const { default: welcomeSequenceFirstJob } =
    await users.welcomeSequenceFirst();
  const { default: welcomeSequenceSecondJob } =
    await users.welcomeSequenceSecond();
  const { default: welcomeSequenceThirdJob } =
    await users.welcomeSequenceThird();
  const { default: publishExperiencesJob } =
    await experiences.publishExperiences();
  const {
    queueExperienceReplyReminders,
    queueExperienceReplyRemindersJob,
    sendExperienceReplyReminder,
    sendExperienceReplyReminderJob,
  } = await experiences.experienceReplyReminders();
  const { sendSupportMessage: supportMessageJob } =
    await support.sendSupportMessage();
  const { pollSupportMailbox: pollSupportMailboxJob } =
    await support.pollSupportMailbox();
  const { recoverSupportMessages: recoverSupportMessagesJob } =
    await support.recoverSupportMessages();

  const { deliverMessagePush, messagePushJobName } =
    await messages.messagePush();
  const { deliverTest, testPushJobName } = await users.testPush();

  const { captureAgendaStorage, captureAgendaStorageJob } =
    await admin.agendaStorage();

  const { captureAgendaInventory } = await admin.agendaInventory();

  const { queueMessageDigests } = await messages.messageDigest();
  const messageDigestJobName = 'queue unread message digests';

  // Keep the existing registration order before starting Agenda.

  agenda.define(
    pruneAgendaDeliveryJobsName,
    async () => {
      const deleted = await pruneAgendaDeliveryJobs(
        mongoose.connection.db!.collection('agendaJobs'),
      );
      if (deleted > 0) {
        // eslint-disable-next-line no-console -- Preserve the worker retention log.
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

  defineJob(agenda, 'send email', sendEmailJob, {
    priority: 'high',
    concurrency: 10,
  });
  defineJob(
    agenda,
    deploymentNotificationJob,
    deploymentNotificationHandler(config.domain, mailMode, sendEmailJob),
    { priority: 'high', concurrency: 10 },
  );

  defineJob(agenda, sendSignupReminderJob, sendEmailJob, {
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
  defineJob(agenda, 'check unread messages', unreadMessagesJob, {
    lockLifetime: 10000,
  });
  defineJob(agenda, 'daily statistics', dailyStatisticsJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob(agenda, 'send signup reminders', signupRemindersJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob(agenda, 'reactivate hosts', reactivateHostsJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob(agenda, 'welcome sequence first', welcomeSequenceFirstJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob(agenda, 'welcome sequence second', welcomeSequenceSecondJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob(agenda, 'welcome sequence third', welcomeSequenceThirdJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  defineJob(agenda, 'publish expired experiences', publishExperiencesJob, {
    lockLifetime: 10000,
    concurrency: 1,
  });
  agenda.define(
    queueExperienceReplyRemindersJob,
    async () => queueExperienceReplyReminders(agenda),
    { concurrency: 1, lockLifetime: 120000 },
  );
  agenda.define(
    sendExperienceReplyReminderJob,
    sendExperienceReplyReminder.bind(null, sendEmailJob),
    {
      concurrency: 2,
      lockLifetime: 60000,
    },
  );
  defineJob(agenda, 'send support message', supportMessageJob, {
    priority: 'high',
    concurrency: 2,
    lockLifetime: 60000,
  });
  defineJob(agenda, 'poll support mailbox', pollSupportMailboxJob, {
    concurrency: 1,
    lockLifetime: 120000,
  });
  defineJob(agenda, 'recover support messages', recoverSupportMessagesJob, {
    concurrency: 1,
    lockLifetime: 120000,
  });
  return () =>
    Promise.all([
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
}

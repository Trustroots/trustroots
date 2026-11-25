import type { Collection } from 'mongodb';
import { mailFailure, mailRetriesExhausted } from './mail-delivery-error.mts';
import { agendaLockLifetime } from './agenda-lock.mts';
import { deploymentNotificationJob } from './deployment-notifications.mts';

export const sendEmailJobName = 'send email';
// Keep in sync with sendSignupReminderJob in the users module.
const sendSignupReminderJobName = 'deliver signup reminder';
const mailDeliveryJobs = [
  sendEmailJobName,
  deploymentNotificationJob,
  sendSignupReminderJobName,
];

export function isMailDeliveryJob(name: string): boolean {
  return mailDeliveryJobs.includes(name);
}
export const recoverEmailJobName = 'recover interrupted email delivery';
const unfinishedAttempt = {
  $gt: ['$lastRunAt', { $ifNull: ['$lastFinishedAt', new Date(0)] }],
};

/** Reclaim interrupted sends, including a retry whose earlier attempt finished. */
export async function recoverInterruptedEmailJobs(
  jobs: Collection,
  now = new Date(),
) {
  const expired = new Date(now.getTime() - agendaLockLifetime);
  return jobs.updateMany(
    {
      name: { $in: mailDeliveryJobs },
      disabled: { $ne: true },
      nextRunAt: null,
      lastRunAt: { $lte: expired },
      $or: [{ lockedAt: null }, { lockedAt: { $lte: expired } }],
      $expr: unfinishedAttempt,
    },
    {
      $set: { nextRunAt: now },
      $unset: { lockedAt: '' },
    },
  );
}

const exhaustedReasons = [mailFailure.temporary, mailFailure.configuration].map(
  reason => mailRetriesExhausted + ': ' + reason,
);
const configurationReasons = [
  mailFailure.configuration,
  mailRetriesExhausted + ': ' + mailFailure.configuration,
];

export async function inspectMailQueue(
  jobs: Collection,
  now = new Date(),
  options: { timeoutMS?: number } = {},
) {
  const pending = {
    name: { $in: mailDeliveryJobs },
    disabled: { $ne: true },
    nextRunAt: { $type: 'date' as const },
  };
  const due = { ...pending, nextRunAt: { ...pending.nextRunAt, $lte: now } };
  const recent = {
    name: { $in: mailDeliveryJobs },
    lastFinishedAt: { $gte: new Date(now.getTime() - 15 * 60_000) },
  };
  const [
    queued,
    oldest,
    retrying,
    exhausted,
    authenticationOrConfiguration,
    heartbeat,
    stalledAttempts,
    latency,
  ] = await Promise.all([
    jobs.countDocuments(pending, options),
    jobs
      .find(due, { ...options, projection: { nextRunAt: 1 } })
      .sort({ nextRunAt: 1 })
      .limit(1)
      .next(),
    jobs.countDocuments({ ...pending, failCount: { $gt: 0 } }, options),
    jobs.countDocuments(
      { ...recent, nextRunAt: null, failReason: { $in: exhaustedReasons } },
      options,
    ),
    jobs.countDocuments(
      {
        ...recent,
        failCount: { $gt: 0 },
        failReason: { $in: configurationReasons },
      },
      options,
    ),
    jobs.findOne(
      { name: recoverEmailJobName, type: 'single' },
      { ...options, projection: { lastFinishedAt: 1, failCount: 1 } },
    ),
    jobs.countDocuments(
      {
        name: { $in: mailDeliveryJobs },
        disabled: { $ne: true },
        nextRunAt: null,
        lastRunAt: { $lte: new Date(now.getTime() - 3 * 60_000) },
        $expr: unfinishedAttempt,
      },
      options,
    ),
    jobs
      .aggregate<{ maxProcessingMs: number }>(
        [
          {
            $match: {
              ...recent,
              lastRunAt: { $type: 'date' },
              $expr: { $lte: ['$lastRunAt', '$lastFinishedAt'] },
            },
          },
          {
            $group: {
              _id: null,
              maxProcessingMs: {
                $max: { $subtract: ['$lastFinishedAt', '$lastRunAt'] },
              },
            },
          },
        ],
        options,
      )
      .next(),
  ]);

  const oldestDueSeconds = oldest
    ? (now.getTime() - oldest.nextRunAt.getTime()) / 1000
    : 0;
  const workerHealthy =
    heartbeat?.lastFinishedAt instanceof Date &&
    (heartbeat.failCount ?? 0) === 0 &&
    now.getTime() - heartbeat.lastFinishedAt.getTime() <= 3 * 60_000;
  return {
    queued,
    oldestDueSeconds,
    retrying,
    exhausted,
    authenticationOrConfiguration,
    workerHealthy,
    stalledAttempts,
    maxProcessingMs: latency?.maxProcessingMs ?? null,
  };
}

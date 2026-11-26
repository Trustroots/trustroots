import { createHash } from 'node:crypto';
import { mongo, type Connection } from 'mongoose';
import type { Job } from 'agenda';
import type { RenderedEmail } from '../../modules/core/server/services/email.server.service.mts';
import {
  canSendDeploymentNotifications,
  findDeploymentNotificationAddresses,
} from './deployment-notification-recipients.mts';

export const deploymentNotificationJob = 'send deployment notification email';

interface SuccessReceipt {
  eventId: string;
  origin: string;
  action: 'deploy' | 'rollback';
  buildCommit: string;
  readinessSucceededAt: string;
}

export function readDeploymentSuccessReceipt(input: string): SuccessReceipt {
  const value = JSON.parse(input) as Record<string, unknown> | null;
  if (
    value?.schemaVersion !== 1 ||
    value.status !== 'succeeded' ||
    typeof value.eventId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value.eventId,
    ) ||
    (value.origin !== 'https://trustroots.org' &&
      value.origin !== 'https://www.trustroots.org') ||
    (value.action !== 'deploy' && value.action !== 'rollback') ||
    typeof value.buildCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(value.buildCommit) ||
    typeof value.readinessSucceededAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?\+00:00$/.test(
      value.readinessSucceededAt,
    ) ||
    !Number.isFinite(Date.parse(value.readinessSucceededAt))
  ) {
    throw new Error('Expected a successful production deployment receipt.');
  }
  return {
    eventId: value.eventId,
    origin: value.origin,
    action: value.action,
    buildCommit: value.buildCommit,
    readinessSucceededAt: value.readinessSucceededAt,
  };
}

interface NotificationProgress extends Omit<SuccessReceipt, 'eventId'> {
  _id: string;
  addresses: string[];
  queuedCount: number;
}

type MailMode = Parameters<typeof canSendDeploymentNotifications>[1];

export async function queueDeploymentNotifications(
  db: NonNullable<Connection['db']>,
  receipt: SuccessReceipt,
  from: string,
): Promise<number> {
  const events = db.collection<NotificationProgress>('deploymentNotifications');
  const { eventId: _id, ...metadata } = receipt;
  const writeConcern = { w: 'majority' as const, j: true };
  let progress = await events.findOne({ _id });
  if (!progress) {
    const addresses = [
      ...(await findDeploymentNotificationAddresses(db)),
    ].sort();
    try {
      progress = (await events.findOneAndUpdate(
        { _id },
        { $setOnInsert: { ...metadata, addresses, queuedCount: 0 } },
        { upsert: true, returnDocument: 'after', writeConcern },
      ))!;
    } catch (error) {
      // MongoDB 4.4 can raise E11000 when concurrent upserts race on _id.
      if ((Object(error) as { code?: unknown }).code !== 11000) throw error;
      progress = (await events.findOne({ _id }))!;
    }
  }
  if (
    progress.origin !== receipt.origin ||
    progress.action !== receipt.action ||
    progress.buildCommit !== receipt.buildCommit ||
    progress.readinessSucceededAt !== receipt.readinessSucceededAt
  ) {
    throw new Error(
      'Deployment receipt conflicts with saved notification progress.',
    );
  }

  const action = receipt.action === 'rollback' ? 'rollback' : 'deployment';
  const subject = `Trustroots production ${action} verified`;
  const text = [
    `The Trustroots production ${action} passed readiness and login checks.`,
    '',
    `Deployed commit: https://github.com/Trustroots/trustroots/commit/${receipt.buildCommit}`,
    `Readiness verified at: ${receipt.readinessSucceededAt} (UTC)`,
    'Mail mode: live',
  ].join('\n');
  const jobs = db.collection('agendaJobs');
  for (
    let index = progress.queuedCount;
    index < progress.addresses.length;
    index++
  ) {
    const jobId = new mongo.ObjectId(
      createHash('sha256')
        .update(`deployment-notification:${_id}:${index}`)
        .digest('hex')
        .slice(0, 24),
    );
    const data: RenderedEmail = {
      to: { address: progress.addresses[index] },
      from: { name: 'Trustroots', address: from },
      subject,
      text,
    };
    // Mongo's unique _id makes the insert safe even when a worker has already
    // started the job or the previous insert was acknowledged after a timeout.
    await jobs.updateOne(
      { _id: jobId },
      {
        $setOnInsert: {
          name: deploymentNotificationJob,
          type: 'normal',
          priority: 10,
          nextRunAt: new Date(),
          deploymentEventId: _id,
          data,
        },
      },
      { upsert: true, writeConcern },
    );
    await events.updateOne(
      { _id },
      { $max: { queuedCount: index + 1 } },
      { writeConcern },
    );
  }
  return progress.addresses.length;
}

export function deploymentNotificationHandler(
  domain: string,
  mailMode: MailMode,
  sendEmail: (
    job: Job<RenderedEmail>,
    done: (error?: Error | null) => void,
  ) => void,
) {
  return (job: Job<RenderedEmail>, done: (error?: Error | null) => void) => {
    if (!canSendDeploymentNotifications(domain, mailMode)) {
      done(
        new Error('Deployment notification requires production and live mail.'),
      );
      return;
    }
    sendEmail(job, done);
  };
}

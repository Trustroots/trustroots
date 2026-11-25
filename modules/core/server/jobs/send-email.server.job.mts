import type { Job } from 'agenda';
import type { RenderedEmail } from '../services/email.server.service.mts';
import nodemailer from 'nodemailer';
import config, { mailMode } from '../../../../config/config.mts';
import { MailDeliveryError } from '../../../../config/lib/mail-delivery-error.mts';
import log from '@trustroots/logger';

type CanDeliverNotificationEmail = (
  notification: NonNullable<RenderedEmail['notificationEmail']>,
  email: string | undefined,
) => Promise<boolean>;

type DeliverSignupReminder = (
  reminder: NonNullable<RenderedEmail['signupReminder']>,
  email: string | undefined,
  send: () => Promise<void>,
) => Promise<void>;

export type SendEmailJob = (
  job: {
    attrs: Pick<Job<RenderedEmail>['attrs'], 'data' | 'failCount'> & {
      _id?: { toString(): string };
    };
  },
  done: (error?: Error | null) => void,
) => void;

export default function createSendEmailJob({
  canDeliverNotificationEmail,
  deliverSignupReminder,
}: {
  canDeliverNotificationEmail: CanDeliverNotificationEmail;
  deliverSignupReminder: DeliverSignupReminder;
}): SendEmailJob {
  return function sendEmailJob(job, done) {
    deliverEmail(job).then(
      () => done(),
      error => done(new MailDeliveryError(error)),
    );
  };

  async function deliverEmail(job: Parameters<SendEmailJob>[0]) {
    const { deliveryDeadline, notificationEmail, signupReminder, ...mail } =
      job.attrs.data!;
    const jobId = job.attrs._id?.toString();
    const metadata = {
      jobId,
      attempt: (job.attrs.failCount ?? 0) + 1,
      mailMode,
    };
    if (deliveryDeadline && deliveryDeadline <= new Date()) {
      log('info', 'Queued email expired', metadata);
      return;
    }
    if (signupReminder) {
      await deliverSignupReminder(signupReminder, mail.to.address, () =>
        sendRenderedEmail(mail, jobId, metadata),
      );
      return;
    }
    if (
      notificationEmail &&
      !(await canDeliverNotificationEmail(notificationEmail, mail.to.address))
    ) {
      log('info', 'Queued email skipped by notification policy', metadata);
      return;
    }

    await sendRenderedEmail(mail, jobId, metadata);
  }
}

async function sendRenderedEmail(
  mail: Omit<
    RenderedEmail,
    'notificationEmail' | 'signupReminder' | 'deliveryDeadline'
  >,
  jobId: string | undefined,
  metadata: {
    jobId: string | undefined;
    attempt: number;
    mailMode: typeof mailMode;
  },
) {
  const transport = nodemailer.createTransport(config.mailer.options);
  // Keep the same Message-ID on a retry for provider-side diagnosis.
  const messageId = `<agenda-${jobId}@${config.domain}>`;
  const startedAt = Date.now();
  try {
    const info = await transport.sendMail({ ...mail, messageId });
    let outcome = 'Queued email captured';
    if (mailMode !== 'capture') {
      if (Array.isArray(info?.accepted) && info.accepted.length) {
        outcome = 'Queued email accepted by SMTP';
      } else if (mailMode === 'live') {
        throw Object.assign(
          new Error('Live SMTP transport returned no accepted recipients'),
          {
            code: 'ECONFIG',
          },
        );
      } else {
        outcome = 'Queued email finished in allowlist mode';
      }
    }
    const providerMessageId = info?.serverMessageId;
    const providerMetadata =
      outcome === 'Queued email accepted by SMTP' &&
      typeof providerMessageId === 'string' &&
      /^<[a-z\d_.+-]{1,128}@[a-z\d.-]{1,128}>$/i.test(providerMessageId)
        ? { providerMessageId }
        : {};
    log('info', outcome, {
      ...metadata,
      messageId,
      ...providerMetadata,
      processingMs: Date.now() - startedAt,
    });
  } finally {
    transport.close();
  }
}

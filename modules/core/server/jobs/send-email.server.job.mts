import { canDeliverNotificationEmail } from '../../../users/server/services/notification-email.server.service.mts';
import type { Job } from 'agenda';
import { deliverSignupReminder } from '../../../users/server/services/signup-reminder.server.service.mts';
import type { RenderedEmail } from '../services/email.server.service.mts';
import nodemailer from 'nodemailer';
import config from './../../../../config/config.mts';
import log from '@trustroots/logger';
export default function (
  job: {
    attrs: Pick<Job<RenderedEmail>['attrs'], 'data'> & {
      _id?: { toString(): string };
    };
  },
  done: (error?: Error | null) => void,
) {
  const email = job.attrs.data!;
  const { notificationEmail, signupReminder, ...mail } = email;
  if (signupReminder) {
    deliverSignupReminder(
      signupReminder,
      mail.to.address,
      () =>
        new Promise<void>((resolve, reject) => {
          send(mail, error => (error ? reject(error) : resolve()));
        }),
    ).then(() => done(), done);
    return;
  }
  if (!notificationEmail) {
    send(mail, done);
    return;
  }
  canDeliverNotificationEmail(notificationEmail, email.to.address).then(
    allowed => {
      if (allowed) send(mail, done);
      else done();
    },
    done,
  );

  function send(
    mail: Omit<RenderedEmail, 'notificationEmail' | 'signupReminder'>,
    done: (error?: Error | null) => void,
  ) {
    const smtpTransport = nodemailer.createTransport(config.mailer.options);

    // Get job id from Agenda job attributes
    // Agenda stores Mongo `ObjectId` so turning that into a string here
    const jobId = (
      job.attrs._id as NonNullable<Job['attrs']['_id']>
    ).toString();

    // Log that we're sending an email
    log('debug', 'Starting `send email` job #wGcxmQ', {
      jobId,
    });
    smtpTransport.sendMail(mail, function (err) {
      smtpTransport.close(); // close the connection pool

      if (err) {
        // Log the failure to send the message
        log('error', 'The `send email` job failed #VDKMbr', {
          jobId,
          error: err,
        });
        return done(err);
      } else {
        // Log the successful delivery of the message
        log('info', 'Successfully finished `send email` job #4vO5Vt', {
          jobId,
        });
        return done();
      }
    });
  }
}

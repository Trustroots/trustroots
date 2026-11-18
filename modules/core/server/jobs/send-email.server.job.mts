import { canDeliverNotificationEmail } from '../../../users/server/services/notification-email.server.service.mts';
import type { Job } from 'agenda';
import type { RenderedEmail } from '../services/email.server.service.mts';
import _ from 'lodash';
import nodemailer from 'nodemailer';
import config from './../../../../config/config.mts';
import log from './../../../../config/lib/logger.mjs';
export default function (
  job: Pick<Job<RenderedEmail>, 'attrs'>,
  done: (error?: Error | null) => void,
) {
  const email = job.attrs.data!;
  const { notificationEmail, ...mail } = email;
  if (!notificationEmail) {
    send(mail);
    return;
  }
  canDeliverNotificationEmail(notificationEmail, email.to.address).then(
    allowed => {
      if (allowed) send(mail);
      else done();
    },
    done,
  );

  function send(mail: Omit<RenderedEmail, 'notificationEmail'>) {
    const smtpTransport = nodemailer.createTransport(config.mailer.options);

    // Get job id from Agenda job attributes
    // Agenda stores Mongo `ObjectId` so turning that into a string here
    const jobId = (
      _.get(job, 'attrs._id') as NonNullable<Job['attrs']['_id']>
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

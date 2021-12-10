const _ = require('lodash');
const nodemailer = require('nodemailer');
const path = require('path');
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));

module.exports = function (job, done) {
  const smtpTransport = nodemailer.createTransport(config.mailer.options);

  // Get job id from Agenda job attributes
  // Agenda stores Mongo `ObjectId` so turning that into a string here
  const jobId = _.get(job, 'attrs._id').toString();

  // Log that we're sending an email
  log('debug', 'Starting `send email` job #wGcxmQ', { jobId });

  smtpTransport.sendMail(job.attrs.data, function (err) {
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
};

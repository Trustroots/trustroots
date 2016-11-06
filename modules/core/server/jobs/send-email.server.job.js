'use strict';

var _ = require('lodash'),
    nodemailer = require('nodemailer'),
    path = require('path'),
    config = require(path.resolve('./config/config')),
    log = require(path.resolve('./config/lib/logger')).log;

module.exports = function(job, done) {
  var smtpTransport = nodemailer.createTransport(config.mailer.options);

  // The agenda docs don't show the shape of `job` so we're guessing here...
  var jobId = _.get(job, '_id')

  // Log that we're sending an email
  log('debug', 'Starting `send email` job #wGcxmQ', {jobId});

  smtpTransport.sendMail(job.attrs.data, function(err) {
    smtpTransport.close(); // close the connection pool

    if (err) {
      // Log the failure to send the message
      log('error', 'The `send email` job failed #VDKMbr', {jobId, err})

      return done(err);
    } else {
      // Log the successful delivery of the message
      log('info', 'Successfully finished `send email` job #4vO5Vt', {jobId})

      return done();
    }
  });
};

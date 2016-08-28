'use strict';

var path = require('path'),
    format = require('util').format,
    agenda = require(path.resolve('./config/lib/agenda'));

exports.start = function(options, callback) {

  agenda.on('ready', function() {

    // Define jobs

    agenda.define(
      'send email',
      { priority: 'high', concurrency: 10 },
      require(path.resolve('./modules/core/server/jobs/send-email.server.job'))
    );

    agenda.define(
      'check unread messages',
      { lockLifetime: 10000 },
      require(path.resolve('./modules/messages/server/jobs/message-unread.server.job'))
    );

    // Schedule job(s)

    agenda.every('5 minutes', 'check unread messages');

    // Start worker

    agenda.start();
    if (process.env.NODE_ENV !== 'test') {
      console.log('Agenda started processing background jobs');
    }

    if (callback) callback();

  });

  // Error reporting and retry logic
  agenda.on('fail', function(err, job) {

    var extraMessage = '';

    if (job.attrs.failCount >= options.maxAttempts) {

      extraMessage = format('too many failures, giving up');

    } else if (shouldRetry(err)) {

      job.attrs.nextRunAt = secondsFromNowDate(options.retryDelaySeconds);

      extraMessage = format('will retry in %s seconds at %s',
        options.retryDelaySeconds, job.attrs.nextRunAt.toISOString());

      job.save();
    }

    if (process.env.NODE_ENV !== 'test') {
      console.error('Agenda job [%s] %s failed with [%s] %s failCount:%s',
        job.attrs.name, job.attrs._id, err.message || 'Unknown error', extraMessage, job.attrs.failCount);
    }

  });

};

function shouldRetry(err) {

  // Retry on connection errors as they may just be temporary
  if (/(ECONNRESET|ECONNREFUSED)/.test(err.message)) {
    return true;
  }
  return false;
}

function secondsFromNowDate(seconds) {
  return new Date(new Date().getTime() + (seconds * 1000));
}

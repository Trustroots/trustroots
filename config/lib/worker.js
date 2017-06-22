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
      'send facebook notification',
      { priority: 'high', concurrency: 10 },
      require(path.resolve('./modules/core/server/jobs/send-facebook-notification.server.job'))
    );

    agenda.define(
      'send push message',
      { priority: 'high', concurrency: 10 },
      require(path.resolve('./modules/core/server/jobs/send-push-message.server.job'))
    );

    agenda.define(
      'check unread messages',
      { lockLifetime: 10000 },
      require(path.resolve('./modules/messages/server/jobs/message-unread.server.job'))
    );

    agenda.define(
      'daily statistics',
      { lockLifetime: 10000, concurrency: 1 },
      require(path.resolve('./modules/statistics/server/jobs/daily-statistics.server.job'))
    );

    agenda.define(
      'send signup reminders',
      { lockLifetime: 10000, concurrency: 1 },
      require(path.resolve('./modules/users/server/jobs/user-finish-signup.server.job'))
    );

    agenda.define(
      'reactivate hosts',
      { lockLifetime: 10000, concurrency: 1 },
      require(path.resolve('./modules/offers/server/jobs/reactivate-hosts.server.job'))
    );

    agenda.define(
      'welcome sequence first',
      { lockLifetime: 10000, concurrency: 1 },
      require(path.resolve('./modules/users/server/jobs/user-welcome-sequence-first.server.job'))
    );

    agenda.define(
      'welcome sequence second',
      { lockLifetime: 10000, concurrency: 1 },
      require(path.resolve('./modules/users/server/jobs/user-welcome-sequence-second.server.job'))
    );

    agenda.define(
      'welcome sequence third',
      { lockLifetime: 10000, concurrency: 1 },
      require(path.resolve('./modules/users/server/jobs/user-welcome-sequence-third.server.job'))
    );

    // Schedule job(s)

    agenda.every('5 minutes', 'check unread messages');
    agenda.every('24 hours', 'daily statistics');
    agenda.every('30 minutes', 'send signup reminders');
    agenda.every('30 minutes', 'reactivate hosts');
    agenda.every('15 minutes', 'welcome sequence first');
    agenda.every('60 minutes', 'welcome sequence second');
    agenda.every('60 minutes', 'welcome sequence third');

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

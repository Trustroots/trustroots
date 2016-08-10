var path = require('path'),
    format = require('util').format,
    mongoose = require(path.resolve('./config/lib/mongoose')),
    agenda = require(path.resolve('./config/lib/agenda'));

var MAX_ATTEMPTS = 10;
var RETRY_DELAY_SECONDS = 10;

init(function() {

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

  if (process.env.NODE_ENV !== 'test') {
    // Schedule job(s)
    agenda.every('5 minutes', 'check unread messages');
  }

  // Start worker
  agenda.start();
  console.log('Agenda started processing background jobs');

});

// Error reporting and retry logic
agenda.on('fail', function(err, job) {

  var extraMessage = '';

  if (job.attrs.failCount >= MAX_ATTEMPTS) {

    extraMessage = format('too many failures, giving up');

  } else if (shouldRetry(err)) {

    job.attrs.attempt = (job.attrs.attempt || 0) + 1;
    job.attrs.nextRunAt = secondsFromNowDate(RETRY_DELAY_SECONDS);

    extraMessage = format('will retry in %s seconds at %s',
      RETRY_DELAY_SECONDS, job.attrs.nextRunAt.toISOString());

    job.save();
  }

  console.error('Agenda job [%s] %s failed with [%s] %s failCount:%s',
    job.attrs.name, job.attrs._id, err.message || 'Unknown error', extraMessage, job.attrs.failCount);

});

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

function init(callback) {
  agenda.on('ready', function() {
    mongoose.connect(function() {
      mongoose.loadModels();
      callback();
    });
  });
}

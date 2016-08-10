var nodemailer = require('nodemailer'),
    path = require('path'),
    config = require(path.resolve('./config/config')),
    mongoose = require(path.resolve('./config/lib/mongoose')),
    agenda = require(path.resolve('./config/lib/agenda'));

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

// Error reporting
agenda.on('fail', function(err, job) {
  console.error('Agenda job failed with error: %s', err.message || 'Unknown error', err.stack);
});

function init(callback) {
  agenda.on('ready', function() {
    mongoose.connect(function() {
      mongoose.loadModels();
      callback();
    });
  });
}

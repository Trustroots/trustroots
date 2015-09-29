'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
    path = require('path'),
    chalk = require('chalk'),
    Agenda = require('agenda');

exports.setupJobs = function() {

  // Load jobs
  var messagesUnreadJob = require(path.resolve('./modules/messages/server/jobs/message-unread.server.job'));

  // Setup agenda
  var agendaWorker = new Agenda({db: { address: config.db.uri, collection: 'agendaJobs' } });

  // Schedule jobs
  messagesUnreadJob.checkUnreadMessages(agendaWorker);

  agendaWorker.every('5 minutes', 'check unread messages');

  // Error reporting
  agendaWorker.on('fail', function(err, job) {
    console.error('Agenda job failed with error: %s', err.message);
  });

  agendaWorker.start();
  console.log(chalk.green('[agenda] started processing background jobs'));
};

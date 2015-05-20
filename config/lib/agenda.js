'use strict';

var config = require('./config');

if(process.env.NODE_ENV === 'production' && config.newrelic.enabled === true) {
  var newrelic = require('newrelic');
}

exports.setupJobs = function() {

  /**
   * Module dependencies.
   */
  var path = require('path'),
      chalk = require('chalk'),
      Agenda = require('agenda');

  // Load jobs
  var messagesUnreadJob = require(path.resolve('./modules/messages/server/jobs/message-unread.server.job'));

  // Setup agenda
<<<<<<< HEAD:config/agenda.js
  var Agenda = require('agenda');
  var agenda = new Agenda({db: { address: config.db.uri, collection: 'agendaJobs' } });
=======
  var agenda = new Agenda({db: { address: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/agenda'}});
>>>>>>> origin/vertical-modules:config/lib/agenda.js

  // Schedule jobs
  messagesUnreadJob.checkUnreadMessages(agenda);

  agenda.every('5 minutes', 'check unread messages');

  // Error reporting
  agenda.on('fail', function(err, job) {
    console.error('Agenda job failed with error: %s', err.message);
    if(newrelic) newrelic.noticeError(err);
  });

  agenda.start();
  console.log(chalk.green('[agenda] started processing background jobs'));
};

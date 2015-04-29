'use strict';

var config = require('./config');

if(process.env.NODE_ENV === 'production' && config.newrelic.enabled === true) {
  var newrelic = require('newrelic');
}

exports.setupJobs = function() {

  // Load jobs
  var messagesUnreadJob = require('../app/jobs/message-unread.server.job');

  // Setup agenda
  var Agenda = require('agenda');
  var agenda = new Agenda({db: { address: config.db.uri, collection: 'agendaJobs' } });

  // Schedule jobs
  messagesUnreadJob.checkUnreadMessages(agenda);
  agenda.every('5 minutes', 'check unread messages');
  agenda.on('fail', function(err, job) {
    console.error('Agenda job failed with error: %s', err.message);
    if(newrelic) newrelic.noticeError(err);
  });

  agenda.start();
  console.log('Agenda started processing background jobs.');
};

'use strict';

var config = require('./config');
exports.setupJobs = function() {

  // Load jobs
  var messagesUnreadJob = require('../app/jobs/message-unread.server.job');

  // Setup agenda
  var Agenda = require('agenda');
  var agenda = new Agenda({db: { address: config.db.uri, collection: 'agendaJobs' } });

  // Schedule jobs
  messagesUnreadJob.checkUnreadMessages(agenda);
  agenda.every('5 minutes', 'check unread messages');

  agenda.start();
  console.log('Agenda started processing background jobs.');
};

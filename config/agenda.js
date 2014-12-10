'use strict';

exports.setupJobs = function() {

  // Load jobs
  var messagesUnreadJob = require('../app/jobs/message-unread.server.job');

  // Setup agenda
  var Agenda = require('Agenda');
  var agenda = new Agenda({db: { address: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/agenda'}});

  // Schedule jobs
  messagesUnreadJob.checkUnreadMessages(agenda);
  agenda.every('5 minutes', 'check unread messages');

  agenda.start();
  console.log('Agenda started processing background jobs.');
};

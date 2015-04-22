'use strict';

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
  var agenda = new Agenda({db: { address: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/agenda'}});

  // Schedule jobs
  messagesUnreadJob.checkUnreadMessages(agenda);
  agenda.every('5 minutes', 'check unread messages');

  agenda.start();
  console.log(chalk.green('[agenda] started processing background jobs'));
};

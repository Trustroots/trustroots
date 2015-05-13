'use strict';
/**
 * Trustroots
 *
 * App's main entry file
 */

// Dependencies
var config = require('./config/config'),
    mongoose = require('./config/lib/mongoose'),
    express = require('./config/lib/express'),
    agenda = require('./config/lib/agenda'),
    chalk = require('chalk');

// Initialize mongoose
mongoose.connect(function(db) {

  // NewRelic monitoring
  // @link http://newrelic.com/
  if(process.env.NODE_ENV === 'production' && config.newrelic.enabled === true) {
    var newrelic = require('./config/lib/newrelic');
    console.log(chalk.green('Started monitoring with NewRelic'));
  }

  // Initialize express
  var app = express.init(db);

  // Start the app by listening on <port>
  app.listen(config.port);

  // Setup Agenda ("cron" jobs)
  agenda.setupJobs();

  // Check in case mailer config is still set to default values (a common problem)
  if(config.mailer.service && config.mailer.service === 'MAILER_SERVICE_PROVIDER') {
    console.warn(chalk.red('Remember to setup mailer from ./config/env/local.js - some features won\'t work without it.'));
  }

  // Logging initialization
  console.log('--');
  console.log(chalk.green('Trustroots started'));
  console.log(chalk.green('Environment:\t\t\t' + process.env.NODE_ENV));
  console.log(chalk.green('Port:\t\t\t\t' + config.port));
  console.log(chalk.green('Database:\t\t\t' + config.db.uri));

  // Reset console color
  console.log(chalk.white('--'));

});

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
    chalk = require('chalk');

/**
 * Debug Node.js C/C++ native code modules on dev mode
 * @link https://www.npmjs.com/package/segfault-handler
 */
if(process.env.NODE_ENV === 'development') {
  var SegfaultHandler = require('segfault-handler');
  SegfaultHandler.registerHandler('segfault.log');
  console.log('Logging possible segfault errors to ./segfault.log');
}

// Initialize mongoose
mongoose.connect(function(db) {

  // Initialize express
  var app = express.init(db);

  // Start the app by listening on <port>
  app.listen(config.port);

  // Check in case mailer config is still set to default values (a common problem)
  if(config.mailer.service && config.mailer.service === 'MAILER_SERVICE_PROVIDER') {
    console.warn(chalk.red('Remember to setup mailer from ./config/env/local.js - some features won\'t work without it.'));
  }

  // Logging initialization
  console.log(chalk.white('--'));
  console.log(chalk.green(new Date()));
  console.log(chalk.green('Trustroots is rolling now.'));
  console.log(chalk.green('Environment:\t\t' + process.env.NODE_ENV));
  console.log(chalk.green('Database:\t\t' + config.db.uri));
  console.log(chalk.green('HTTPS:\t\t\t' + (config.https ? 'on' : 'off')));
  console.log(chalk.green('Port:\t\t\t' + config.port));
  console.log(chalk.green('Image processor:\t\t' + config.imageProcessor));
  console.log(chalk.green('Phusion Passenger:\t' + (typeof(PhusionPassenger) !== 'undefined' ? 'on' : 'off')));

  // Reset console color
  console.log(chalk.white('--'));

});

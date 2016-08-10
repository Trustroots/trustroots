'use strict';
/**
 * Trustroots
 *
 * App's main entry file
 */

// Debug Node.js C/C++ native code modules on dev mode
// @link https://www.npmjs.com/package/segfault-handler
if (process.env.NODE_ENV === 'development') {
  var SegfaultHandler = require('segfault-handler');
  SegfaultHandler.registerHandler('segfault.log');
  console.log('[Server] Logging possible segfault errors to ./segfault.log');
}

// Dependencies
var config = require('./config/config'),
    mongoose = require('./config/lib/mongoose'),
    express = require('./config/lib/express'),
    chalk = require('chalk');

// Initialize mongoose
mongoose.connect(function(db) {

  // Initialize express
  var app = express.init(db);

  // Start the app by listening on <port>
  app.listen(config.port);

  // Check in case mailer config is still set to default values (a common problem)
  if (config.mailer.service && config.mailer.service === 'MAILER_SERVICE_PROVIDER') {
    console.warn(chalk.red('[Server] Remember to setup mailer from ./config/env/local.js - some features won\'t work without it.'));
  }

  // Logging initialization
  console.log(chalk.white('--'));
  console.log(chalk.green('[Server] ' + new Date()));
  console.log(chalk.green('[Server] Environment:\t\t' + process.env.NODE_ENV));
  console.log(chalk.green('[Server] Database:\t\t' + config.db.uri));
  console.log(chalk.green('[Server] HTTPS:\t\t\t' + (config.https ? 'on' : 'off')));
  console.log(chalk.green('[Server] Port:\t\t\t' + config.port));
  console.log(chalk.green('[Server] Image processor:\t' + config.imageProcessor));
  console.log(chalk.green('[Server] Phusion Passenger:\t' + (typeof(PhusionPassenger) !== 'undefined' ? 'on' : 'off')));

  // Reset console color
  console.log(chalk.white('--'));
  console.log('');
  console.log(chalk.white('Trustroots server is up and running now.'));
  console.log('');

});

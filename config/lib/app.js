'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
    mongoose = require('./mongoose'),
    express = require('./express'),
    chalk = require('chalk');

// Initialize Models
mongoose.loadModels();

module.exports.init = function init(callback) {

  mongoose.connect(function (connection) {
    // Initialize express
    var app = express.init(connection);
    if (callback) callback(app, connection, config);
  });
};

module.exports.start = function start(callback) {

  var _this = this;

  _this.init(function (app, db, config) {

    // Start the app by listening on <port> at <host>
    app.listen(config.port, config.host, function () {

      // Check in case mailer config is still set to default values (a common problem)
      if (config.mailer.service && config.mailer.service === 'MAILER_SERVICE_PROVIDER') {
        console.warn(chalk.red('Remember to setup mailer from ./config/env/local.js - some features won\'t work without it.'));
      }

      // Logging initialization
      console.log(chalk.white('--'));
      console.log(chalk.green(new Date()));
      console.log(chalk.green('Environment:\t\t' + process.env.NODE_ENV));
      console.log(chalk.green('Database:\t\t' + config.db.uri));
      console.log(chalk.green('HTTPS:\t\t\t' + (config.https ? 'on' : 'off')));
      console.log(chalk.green('Port:\t\t\t' + config.port));
      console.log(chalk.green('Image processor:\t' + config.imageProcessor));
      console.log(chalk.green('Phusion Passenger:\t' + (typeof(PhusionPassenger) !== 'undefined' ? 'on' : 'off')));
      console.log(chalk.green('InfluxDB:\t\t' + (config.influxdb && config.influxdb.enabled === true ? 'on' : 'off')));

      // Reset console color
      console.log(chalk.white('--'));
      console.log('');
      console.log(chalk.white('Trustroots is up and running now.'));
      console.log('');

      if (callback) callback(app, db, config);
    });

  });

};

/**
 * Module dependencies.
 */
const config = require('../config');
const mongoose = require('./mongoose');
const express = require('./express');
const chalk = require('chalk');
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

if (config.sentry.enabled) {
  Sentry.init({
    ...config.sentry.options,
    integrations: [new Tracing.Integrations.Mongo({ useMongoose: true })],
  });
}

// Initialize Models
mongoose.loadModels();

module.exports.init = function init(callback) {
  mongoose.connect(function (connection) {
    // Initialize express
    const app = express.init(connection);
    if (callback) callback(app, connection, config);
  });
};

module.exports.start = function start(callback) {
  const _this = this;

  _this.init(function (app, db, config) {
    const listenArgs = [];
    if (config.fd) {
      // Start the app by listening on a file descriptor (useful for systemd socket activation)
      listenArgs.push({ fd: config.fd });
    } else {
      // Start the app by listening on <port> at <host>
      listenArgs.push(config.port, config.host);
    }
    app.listen(...listenArgs, function () {
      // Check in case mailer config is still set to default values (a common problem)
      if (
        config.mailer.service &&
        config.mailer.service === 'MAILER_SERVICE_PROVIDER'
      ) {
        console.warn(
          chalk.red(
            "Remember to setup mailer from ./config/env/local.js - some features won't work without it.",
          ),
        );
      }

      // Logging initialization
      console.log(chalk.white('--'));
      console.log(chalk.green(new Date()));
      console.log(chalk.green('Environment:\t\t' + process.env.NODE_ENV));
      console.log(chalk.green('Database:\t\t' + config.db.uri));
      console.log(
        chalk.green(
          'Database autoindexing:\t' + (config.db.autoIndex ? 'on' : 'off'),
        ),
      );
      console.log(chalk.green('HTTPS:\t\t\t' + (config.https ? 'on' : 'off')));
      if (config.fd) {
        console.log(chalk.green('File Descriptor:\t' + config.fd));
      } else {
        console.log(chalk.green('Port:\t\t\t' + config.port));
      }
      console.log(chalk.green('Image processor:\t' + config.imageProcessor));
      console.log(
        chalk.green(
          'Phusion Passenger:\t' +
            (typeof PhusionPassenger !== 'undefined' ? 'on' : 'off'),
        ),
      );
      console.log(
        chalk.green(
          'InfluxDB:\t\t' +
            (config.influxdb && config.influxdb.enabled === true
              ? 'on'
              : 'off'),
        ),
      );
      console.log(
        chalk.green(
          'Sentry:\t\t' +
            (config.sentry && config.sentry.enabled === true ? 'on' : 'off'),
        ),
      );

      // Reset console color
      console.log(chalk.white('--'));
      console.log('');
      console.log(chalk.white('Trustroots is up and running now.'));
      console.log('');

      if (callback) callback(app, db, config);
    });
  });
};

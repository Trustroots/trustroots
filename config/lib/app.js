/**
 * Module dependencies.
 */
const config = require('../config');
const mongoose = require('./mongoose');
const express = require('./express');

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
          "Remember to setup mailer from ./config/env/local.js - some features won't work without it.",
        );
      }

      // Logging initialization
      console.log('--');
      console.log(new Date());
      console.log('Environment:\t\t' + process.env.NODE_ENV);
      console.log('Database:\t\t' + config.db.uri);
      console.log(
        'Database autoindexing:\t' + (config.db.autoIndex ? 'on' : 'off'),
      );
      console.log('HTTPS:\t\t\t' + (config.https ? 'on' : 'off'));
      if (config.fd) {
        console.log('File Descriptor:\t' + config.fd);
      } else {
        console.log('Port:\t\t\t' + config.port);
      }
      console.log('Image processor:\t' + config.imageProcessor);
      console.log(
        'Phusion Passenger:\t' +
          (typeof PhusionPassenger !== 'undefined' ? 'on' : 'off'),
      );
      console.log(
        'InfluxDB:\t\t' +
          (config.influxdb && config.influxdb.enabled === true ? 'on' : 'off'),
      );
      console.log('--');
      console.log('');
      console.log('Trustroots is up and running now.');
      console.log('');

      if (callback) callback(app, db, config);
    });
  });
};

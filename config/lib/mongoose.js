'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    config = require('../config'),
    chalk = require('chalk'),
    path = require('path'),
    mongoose = require('mongoose');

// Load the mongoose models
module.exports.loadModels = function(callback, logprefix) {
  // Globbing model files
  config.files.server.models.forEach(function(modelPath) {
    require(path.resolve(modelPath));
  });

  console.log(chalk.green(formatLogPrefix(logprefix) + 'Loaded Mongoose models'));

  if (callback) {
    callback();
  }
};

// Initialize Mongoose
module.exports.connect = function(callback, logprefix) {

  // Use native promises
  mongoose.Promise = global.Promise;

  var options = _.merge(config.db.options || {}, { useMongoClient: true });

  mongoose
    .connect(config.db.uri, options)
    .then(function (connection) {
      console.log(chalk.green(formatLogPrefix(logprefix) + 'Connected to MongoDB'));

      // Enabling mongoose debug mode if required
      mongoose.set('debug', config.db.debug);

      if (callback) {
        callback(connection.db);
      }
    })
    .catch(function (err) {
      console.error(chalk.red(formatLogPrefix(logprefix) + 'Could not connect to MongoDB!'));
      console.error(err);
    });
};

module.exports.disconnect = function(callback, logprefix) {
  mongoose.connection.db
    .close(function (err) {
      if (err) {
        console.error(chalk.red(formatLogPrefix(logprefix) + 'Could not disconnect to MongoDB!'));
        console.error(err);
      } else {
        console.log(chalk.yellow(formatLogPrefix(logprefix) + 'Disconnected from MongoDB.'));
      }
      return callback(err);
    });
};

/**
 * Log with prefix info
 * Used mainly to add context to logging, e.g. "[worker] message"
 *
 * @param {String} logprefix
 * @return {String}
 */
function formatLogPrefix(logprefix) {
  return logprefix ? '[' + logprefix + '] ' : '';
}

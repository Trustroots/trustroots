'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
    chalk = require('chalk'),
    debug = require('debug')('tr:mongoose'),
    path = require('path'),
    mongoose = require('mongoose');

// Load the mongoose models
module.exports.loadModels = function (callback, logprefix) {
  debug(formatLogPrefix(logprefix) + 'Loading Mongoose models');

  // Globbing model files
  config.files.server.models.forEach(function (modelPath) {
    debug(formatLogPrefix(logprefix) + 'Loading Mongoose model: ' + modelPath);
    require(path.resolve(modelPath));
  });

  debug(formatLogPrefix(logprefix) + 'Loaded Mongoose models');

  if (callback) {
    callback();
  }
};

// Initialize Mongoose
module.exports.connect = function(callback, logprefix, optionsOverride) {

  // Use native promises
  mongoose.Promise = global.Promise;

  var options = optionsOverride ? _.merge(config.db.options || {}, optionsOverride) : config.db.options;

  debug('Connecting to Mongo server: ' + config.db.uri);

  // Setting Mongoose debug mode
  mongoose.set('debug', config.db.debug);

  mongoose.connect(config.db.uri, options, function(err) {
    if (err) {
      return console.error(chalk.red(formatLogPrefix(logprefix) + 'Could not connect to MongoDB! #fh3924'));
    }

    console.log(chalk.green(formatLogPrefix(logprefix) + 'Connected to MongoDB'));

    if (callback) {
      callback();
    }
  });
};

module.exports.disconnect = function(callback, logprefix) {
  debug(formatLogPrefix(logprefix) + 'Attempt to disconnect from MongoDB');
  mongoose.connection.close();

  mongoose.connection.on('disconnecting', function () {
    debug(formatLogPrefix(logprefix) + 'Disconnecting from MongoDB...');
  });

  mongoose.connection.on('disconnected', function () {
    console.log(chalk.yellow(formatLogPrefix(logprefix) + 'Disconnected from MongoDB'));
    return callback();
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

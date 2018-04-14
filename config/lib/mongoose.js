'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
    chalk = require('chalk'),
    path = require('path'),
    mongoose = require('mongoose');

// Load the mongoose models
module.exports.loadModels = function (callback) {
  // Globbing model files
  config.files.server.models.forEach(function (modelPath) {
    require(path.resolve(modelPath));
  });

  if (callback) callback();
};

// Initialize Mongoose
module.exports.connect = function (callback) {
  var _this = this;

  // Use native promises
  // You could use any ES6 promise constructor here, e.g. `bluebird`
  mongoose.Promise = global.Promise;

  // Options for Native MongoDB connection
  // https://mongodb.github.io/node-mongodb-native/2.1/api/Server.html
  // http://mongoosejs.com/docs/connections.html
  var mongoConnectionOptions = {
    server: {
      // Never stop reconnecting
      reconnectTries: Number.MAX_VALUE
    }
  };

  var db = mongoose.connect(config.db.uri, mongoConnectionOptions, function (err) {
    // Log Error
    if (err) {
      console.error(chalk.red('Could not connect to MongoDB!'));
      console.log(err);
    } else {
      // Enabling mongoose debug mode if required
      mongoose.set('debug', config.db.debug);

      // Load modules
      _this.loadModels();

      if (callback) {
        callback(db);
      }
    }
  });
};

module.exports.disconnect = function (callback) {
  mongoose.disconnect(function (err) {
    console.info(chalk.yellow('Disconnected from MongoDB.'));
    callback(err);
  });
};

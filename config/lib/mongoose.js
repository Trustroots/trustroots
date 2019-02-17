'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
    async = require('async'),
    path = require('path'),
    log = require('./logger'),
    mongoose = require('mongoose'),
    semver = require('semver');

/**
 * Options for Native MongoDB connection
 *
 * @link https://mongodb.github.io/node-mongodb-native/2.1/api/Server.html
 * @link https://mongoosejs.com/docs/connections.html
 */
var mongoConnectionOptions = {
  server: {
    // Never stop reconnecting
    reconnectTries: Number.MAX_SAFE_INTEGER
  },
  // https://mongoosejs.com/docs/deprecations.html#-ensureindex-
  useCreateIndex: true,
  // https://mongoosejs.com/docs/deprecations.html#-findandmodify-
  useFindAndModify: false,
  // Mongoose-specific option. Set to false to disable automatic index
  // creation for all models associated with this connection.
  autoIndex: Boolean(config.db.autoIndex)
};

// Load the mongoose models
module.exports.loadModels = function (callback) {
  log('info', 'Loading Mongoose Schemas.', {
    autoIndex: mongoConnectionOptions.autoIndex
  });

  // Globbing model files
  config.files.server.models.forEach(function (modelPath) {
    require(path.resolve(modelPath));
  });

  // Array of registered models
  var models = mongoose.connection.modelNames();

  // Logging for indexing events in models
  models.forEach(function (model) {
    mongoose.model(model).on('index', function (error) {
      if (error) {
        log('error', 'Calling createIndex failed for Mongoose Schema.', {
          error: error,
          model: model
        });
      } else {
        log('info', 'Calling createIndex succeeded for Mongoose Schema.', {
          model: model
        });
      }
    });
  });

  if (callback) {
    callback();
  }
};

// Initialize Mongoose
module.exports.connect = function (callback) {
  var _this = this;

  // Use native promises
  // You could use any ES6 promise constructor here, e.g. `bluebird`
  mongoose.Promise = global.Promise;

  // Enabling mongoose debug mode if required
  mongoose.set('debug', Boolean(config.db.debug));

  async.waterfall([
    // Connect
    function (done) {
      mongoose.connect(config.db.uri, mongoConnectionOptions, function (err) {
        if (err) {
          log('error', 'Could not connect to MongoDB!', {
            error: err
          });
        }
        done(err);
      });
    },
    // Confirm compatibility with MongoDB version
    function (done) {
      // Skip if not check isn't required
      if (!config.db.checkCompatibility) {
        return done();
      }

      var engines = require(path.resolve('./package.json')).engines;
      var admin = new mongoose.mongo.Admin(mongoose.connection.db);
      admin.buildInfo(function (err, info) {
        log('info', 'MongoDB', {
          version: info.version
        });

        if (semver.valid(info.version) && !semver.satisfies(info.version, engines.mongodb)) {
          log('error', 'MongoDB version incompatibility!', {
            version: info.version,
            compatibleVersion: engines.mongodb
          });
          process.exit(1);
        }

        done();
      });
    },
    // Load models
    function (done) {
      _this.loadModels(function () {
        done();
      });
    }
  ],
  function () {
    if (callback) {
      callback(mongoose.connection);
    }
  });
};

module.exports.disconnect = function (callback) {
  mongoose.disconnect(function (err) {
    log('info', 'Disconnected from MongoDB.');
    if (callback) {
      callback(err);
    }
  });
};

module.exports.dropDatabase = function (connection, callback) {
  if (process.env.NODE_ENV === 'production') {
    log('error', 'You cannot drop database in production mode!');
    return process.exit(1);
  }

  connection.dropDatabase(function (err) {
    if (err) {
      log('error', 'Failed to drop database', {
        error: err
      });
    } else {
      log('info', 'Successfully dropped database: ' + connection.db.databaseName);
    }

    if (callback) {
      callback(err);
    }
  });
};

module.exports.ensureIndexes = function (connection, modelNames) {
  return new Promise(function (resolve) {
    // assuming openFiles is an array of file names
    async.each(modelNames, function (modelName, callback) {
      connection.model(modelName).ensureIndexes(function (error) {
        if (error) {
          log('error', 'Indexing Mongoose Schema failed', {
            model: modelName,
            error: error
          });
          callback(error);
        } else {
          log('info', 'Indexed Mongoose Schema ' + modelName);
          callback();
        }
      });
    }, function (error) {
      // if any of the file processing produced an error
      if (error) {
        // One of the iterations produced an error.
        // All processing will now stop.
        log('error', 'A Schema failed to index.');
      } else {
        log('info', 'All Schemas have been indexed successfully.');
      }
      resolve();
    });
  });
};

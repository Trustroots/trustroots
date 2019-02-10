'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
    async = require('async'),
    chalk = require('chalk'),
    path = require('path'),
    log = require('./logger'),
    mongoose = require('mongoose'),
    semver = require('semver');

// Load the mongoose models
module.exports.loadModels = function (callback) {
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
        log('error', 'Indexing Mongoose Schema failed', {
          error: error,
          model: model
        });
      } else {
        log('info', 'Indexed Mongoose Schema', {
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
  mongoose.set('useCreateIndex', true);

  // Options for Native MongoDB connection
  // https://mongodb.github.io/node-mongodb-native/2.1/api/Server.html
  // http://mongoosejs.com/docs/connections.html
  var mongoConnectionOptions = {
    server: {
      // Never stop reconnecting
      reconnectTries: Number.MAX_VALUE
    },
    // https://mongoosejs.com/docs/deprecations.html#-ensureindex-
    useCreateIndex: true,
    // https://mongoosejs.com/docs/deprecations.html#-findandmodify-
    useFindAndModify: false,
    // Mongoose-specific option. Set to false to disable automatic index
    // creation for all models associated with this connection.
    // Ensure indexes manually by running `npm run ensure-indexes`
  };

  async.waterfall([
    // Connect
    function (done) {
      mongoose.connect(config.db.uri, mongoConnectionOptions, function (err) {
        if (err) {
          console.error(chalk.red('Could not connect to MongoDB!'));
          console.error(err);
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
        console.log(chalk.green('MongoDB version: ' + info.version));
        if (semver.valid(info.version) && !semver.satisfies(info.version, engines.mongodb)) {
          console.error(chalk.red('MongoDB version incompatibility! Compatible version(s):', engines.mongodb));
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
    console.info(chalk.yellow('Disconnected from MongoDB.'));
    if (callback) {
      callback(err);
    }
  });
};

module.exports.dropDatabase = function (connection, callback) {
  if (process.env.NODE_ENV === 'production') {
    console.error('You cannot drop database in production mode!');
    return process.exit(1);
  }

  connection.dropDatabase(function (err) {
    if (err) {
      console.error('Failed to drop database', err);
    } else {
      console.log('Successfully dropped database:', connection.db.databaseName);
    }

    if (callback) {
      callback(err);
    }
  });
};

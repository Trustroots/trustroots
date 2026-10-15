import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import config from './../config.mjs';
import async from 'async';
import path from 'path';
import log from './logger.mjs';
import mongoose from 'mongoose';
import semver from 'semver';
const dependency6 = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
type Done = (error?: Error | null) => void;
type DatabaseConfiguration = {
  uri: string;
  autoIndex?: unknown;
  debug?: unknown;
  checkCompatibility?: boolean;
};
const service = {
  loadModels,
  connect,
  disconnect,
  dropDatabase,
  ensureIndexes,
};
/**
 * Module dependencies.
 */

/** Options for the Mongoose connection. */
const mongoConnectionOptions = {
  // Mongoose-specific option. Set to false to disable automatic index
  // creation for all models associated with this connection.
  autoIndex: Boolean((config.db as DatabaseConfiguration).autoIndex),
  // Keep collection creation under the same explicit control as before.
  autoCreate: false,
};

// Load the mongoose models
async function loadModels(callback?: () => void) {
  log('info', 'Loading Mongoose Schemas.', {
    autoIndex: mongoConnectionOptions.autoIndex,
  });

  // Globbing model files
  for (const modelPath of config.files.server.models) {
    await import(pathToFileURL(path.resolve(modelPath)).href);
  }

  // Array of registered models
  const models = mongoose.connection.modelNames();

  // Logging for indexing events in models
  models.forEach(function (model) {
    mongoose.model(model).on('index', function (error) {
      if (error) {
        log('error', 'Calling createIndex failed for Mongoose Schema.', {
          error,
          model,
        });
      } else {
        log('info', 'Calling createIndex succeeded for Mongoose Schema.', {
          model,
        });
      }
    });
  });
  if (callback) {
    callback();
  }
}

// Initialize Mongoose
function connect(
  this: { loadModels: typeof loadModels },
  callback?: (connection: mongoose.Connection) => void,
) {
  // Use native promises
  // You could use any ES6 promise constructor here, e.g. `bluebird`
  mongoose.Promise = global.Promise;

  // Enabling mongoose debug mode if required
  mongoose.set('debug', Boolean((config.db as DatabaseConfiguration).debug));
  // Preserve Mongoose 5's query filtering semantics for existing queries.
  mongoose.set('strictQuery', false);
  async.waterfall(
    [
      // Connect
      function (done: Done) {
        mongoose
          .connect(
            (config.db as DatabaseConfiguration).uri,
            mongoConnectionOptions,
          )
          .then(
            function () {
              done();
            },
            function (err) {
              log('error', 'Could not connect to MongoDB!', {
                error: err,
              });
              done(err);
            },
          );
      },
      // Confirm compatibility with MongoDB version
      function (done: Done) {
        // If the config says we do not need to check compatibility, skip this
        if (!(config.db as DatabaseConfiguration).checkCompatibility) {
          return done();
        }
        const engines = dependency6.engines as { mongodb: string };
        mongoose.connection.db
          .admin()
          .buildInfo()
          .then(function (info) {
            log('info', 'MongoDB', {
              version: info.version,
            });
            if (
              semver.valid(info.version) &&
              !semver.satisfies(info.version, engines.mongodb)
            ) {
              log('error', 'MongoDB version incompatibility!', {
                version: info.version,
                compatibleVersion: engines.mongodb,
              });
              process.exit(1);
            }
            done();
          }, done);
      },
      // Load models
      (done: Done) => {
        this.loadModels(function () {
          done();
        });
      },
    ],
    function () {
      if (callback) {
        callback(mongoose.connection);
      }
    },
  );
}
function disconnect(callback?: Done) {
  mongoose.disconnect().then(
    function () {
      log('info', 'Disconnected from MongoDB.');
      if (callback) callback();
    },
    function (err) {
      if (callback) callback(err);
    },
  );
}
function dropDatabase(connection: mongoose.Connection, callback?: Done) {
  if (process.env.NODE_ENV === 'production') {
    log('error', 'You cannot drop database in production mode!');
    return process.exit(1);
  }
  connection.dropDatabase(function (err) {
    if (err) {
      log('error', 'Failed to drop database', {
        error: err,
      });
    } else {
      log(
        'info',
        'Successfully dropped database: ' + connection.db.databaseName,
      );
    }
    if (callback) {
      callback(err);
    }
  });
}
function ensureIndexes(modelNames: string[]): Promise<void> {
  return new Promise<void>(function (resolve, reject) {
    // assuming openFiles is an array of file names
    async.each(
      modelNames,
      function (modelName, callback) {
        mongoose.connection.model(modelName).ensureIndexes(function (error) {
          if (error) {
            log('error', 'Indexing Mongoose Schema failed', {
              model: modelName,
              error,
            });
            callback(error);
          } else {
            log('info', 'Indexed Mongoose Schema ' + modelName);
            callback();
          }
        });
      },
      function (error) {
        // if any of the file processing produced an error
        if (error) {
          // One of the iterations produced an error.
          // All processing will now stop.
          log('error', 'A Schema failed to index.', {
            error,
          });
          reject(error);
        } else {
          log(
            'info',
            modelNames.length +
              ' Schemas have been indexed successfully:\n - ' +
              modelNames.join('\n - '),
          );
        }
        resolve();
      },
    );
  });
}
export default service;
export { service as 'module.exports' };

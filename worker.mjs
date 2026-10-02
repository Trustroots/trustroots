/**
 * Trustroots
 *
 * Worker main entry file
 */
import async from 'async';
import mongooseService from './config/lib/mongoose.js';
import worker from './config/lib/worker.js';
import log from './config/lib/logger.js';

async.waterfall(
  [
    // Bootstrap db connection
    function (done) {
      mongooseService.connect(function () {
        done();
      });
    },

    // Load models
    function (done) {
      mongooseService.loadModels(done);
    },

    // Clean out database
    function (done) {
      // Attempt to unlock jobs that were stuck due server restart
      // See https://github.com/agenda/agenda/issues/410
      worker.unlockAgendaJobs(done);
    },

    function (done) {
      // Start the worker
      worker.start(
        {
          maxAttempts: 10,
          retryDelaySeconds: 10,
        },
        done,
      );
    },
  ],
  function (err) {
    if (err) {
      log(
        'error',
        '[Worker] Error while initializing the background job worker.',
        err,
      );
      process.exit(1); // eslint-disable-line no-process-exit
    }
  },
);

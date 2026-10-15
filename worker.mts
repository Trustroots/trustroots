/**
 * Trustroots
 *
 * Worker main entry file
 */
import async from 'async';
import mongooseService from './config/lib/mongoose.mjs';
import worker from './config/lib/worker.mjs';
import log from './config/lib/logger.mjs';

async.waterfall(
  [
    // Bootstrap db connection
    function (done: (error?: Error | null) => void) {
      mongooseService.connect(function () {
        done();
      });
    },

    // Load models
    function (done: (error?: Error | null) => void) {
      mongooseService.loadModels(done);
    },

    // Clean out database
    function (done: (error?: Error | null) => void) {
      // Attempt to unlock jobs that were stuck due server restart
      // See https://github.com/agenda/agenda/issues/410
      worker.unlockAgendaJobs(done);
    },

    function (done: (error?: Error | null) => void) {
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
  function (err?: Error | null) {
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

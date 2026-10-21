/**
 * Trustroots
 *
 * Worker main entry file
 */
import mongooseService from './config/lib/mongoose.mjs';
import worker from './config/lib/worker.mjs';
import log from './config/lib/logger.mjs';

async function startWorker() {
  // Bootstrap db connection
  await new Promise<void>(function (resolve) {
    mongooseService.connect(function () {
      resolve();
    });
  });

  // Load models
  await mongooseService.loadModels();

  // Clean out database
  // Attempt to unlock jobs that were stuck due server restart
  // See https://github.com/agenda/agenda/issues/410
  await new Promise<void>(function (resolve, reject) {
    worker.unlockAgendaJobs(function (err) {
      if (err) return reject(err);
      resolve();
    });
  });

  // Start the worker
  await new Promise<void>(function (resolve, reject) {
    worker.start(
      {
        maxAttempts: 10,
        retryDelaySeconds: 10,
      },
      function (err) {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

startWorker().catch(function (err: Error) {
  log(
    'error',
    '[Worker] Error while initializing the background job worker.',
    err,
  );
  process.exit(1); // eslint-disable-line no-process-exit
});

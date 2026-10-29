/** Trustroots background worker entry point. */
import mongooseService from './config/lib/mongoose.mjs';
import worker from './config/lib/worker.mjs';
import log from './config/lib/logger.mjs';
import { startWorker } from './config/lib/start-worker.mts';

startWorker(mongooseService, worker).catch(err => {
  log(
    'error',
    '[Worker] Error while initializing the background job worker.',
    err,
  );
  process.exit(1); // eslint-disable-line no-process-exit
});

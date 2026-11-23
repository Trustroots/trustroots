/** Trustroots background worker entry point. */
import mongooseService from './config/lib/mongoose.mts';
import worker from './config/lib/worker.mts';
import log from '@trustroots/logger';
import config from './config/config.mts';
import { startWorker } from './config/lib/start-worker.mts';

startWorker(mongooseService, worker)
  .then(async () => {
    if (!config.featureFlags.nostranslationAlerts) return;
    const { watchNostranslationAlerts } =
      await import('./modules/mobile/server/services/nostranslation-alert-watcher.server.service.mts');
    watchNostranslationAlerts();
  })
  .catch(err => {
    log(
      'error',
      '[Worker] Error while initializing the background job worker.',
      err,
    );
    process.exit(1); // eslint-disable-line no-process-exit
  });

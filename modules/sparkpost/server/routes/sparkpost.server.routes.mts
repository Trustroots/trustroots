import type { Express } from 'express';
import sparkpost from './../controllers/sparkpost-webhooks.server.controller.mts';

const defaultExport = function (app: Express) {
  app
    .route('/api/sparkpost/webhook')
    .post(sparkpost.basicAuthenticate, sparkpost.receiveBatch);
};
export default defaultExport;
export { defaultExport as 'module.exports' };

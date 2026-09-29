import sparkpost from '../controllers/sparkpost-webhooks.server.controller.js';

/**
 * Module dependencies.
 */

const defaultExport = function (app) {
  app
    .route('/api/sparkpost/webhook')
    .post(sparkpost.basicAuthenticate, sparkpost.receiveBatch);
};
export default defaultExport;

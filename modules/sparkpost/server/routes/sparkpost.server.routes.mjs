import sparkpost from './../controllers/sparkpost-webhooks.server.controller.mjs';

/**
 * Module dependencies.
 */

const defaultExport = function (app) {
  app
    .route('/api/sparkpost/webhook')
    .post(sparkpost.basicAuthenticate, sparkpost.receiveBatch);
};
export default defaultExport;
export { defaultExport as 'module.exports' };

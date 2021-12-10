/**
 * Module dependencies.
 */
const sparkpost = require('../controllers/sparkpost-webhooks.server.controller');

module.exports = function (app) {
  app
    .route('/api/sparkpost/webhook')
    .post(sparkpost.basicAuthenticate, sparkpost.receiveBatch);
};

/**
 * Module dependencies.
 */
const tribesPolicy = require('../policies/tribes.server.policy');
const tribes = require('../controllers/tribes.server.controller');

module.exports = function (app) {
  app.route('/api/tribes').all(tribesPolicy.isAllowed).get(tribes.listTribes);

  app
    .route('/api/tribes/:tribe')
    .all(tribesPolicy.isAllowed)
    .get(tribes.getTribe);

  // Finish by binding the tribes middleware
  app.param('tribe', tribes.tribeBySlug);
};

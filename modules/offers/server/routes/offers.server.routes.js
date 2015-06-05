'use strict';

/**
 * Module dependencies.
 */
var offersPolicy = require('../policies/offers.server.policy'),
    offers = require('../controllers/offers.server.controller');

module.exports = function(app) {

  app.route('/api/offers-by/:userId').all(offersPolicy.isAllowed)
    .get(offers.read);

  app.route('/api/offers').all(offersPolicy.isAllowed)
    .get(offers.list)
    .post(offers.create);

  app.route('/api/offers/:offerId').all(offersPolicy.isAllowed)
    .get(offers.read);

  // Finish by binding the middleware
  app.param('userId', offers.offerByUserId);
  app.param('offerId', offers.offerById);
};

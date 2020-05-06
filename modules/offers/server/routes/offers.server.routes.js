/**
 * Module dependencies.
 */
const offersPolicy = require('../policies/offers.server.policy');
const offers = require('../controllers/offers.server.controller');

module.exports = function (app) {
  app
    .route('/api/offers-by/:offerUserId')
    .all(offersPolicy.isAllowed)
    .get(offers.listOffersByUser);

  app
    .route('/api/offers')
    .all(offersPolicy.isAllowed)
    .get(offers.list)
    .post(offers.create);

  app
    .route('/api/offers/:offerId')
    .all(offersPolicy.isAllowed)
    .get(offers.getOffer)
    .delete(offers.delete)
    .put(offers.update);

  // Finish by binding the middleware
  app.param('offerUserId', offers.offersByUserId);
  app.param('offerId', offers.offerById);
};

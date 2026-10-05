import offersPolicy from './../policies/offers.server.policy.mjs';
import offers from './../controllers/offers.server.controller.mjs';

/**
 * Module dependencies.
 */
function register(app) {
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
}
export { register };
export default register;
export { register as 'module.exports' };

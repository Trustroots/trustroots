import type { Express, RequestHandler, RequestParamHandler } from 'express';

import offersPolicy from './../policies/offers.server.policy.mts';
import offers from './../controllers/offers.server.controller.mjs';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;
const parameterHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestParamHandler => callback as unknown as RequestParamHandler;

/**
 * Module dependencies.
 */
function register(app: Express) {
  app
    .route('/api/offers-by/:offerUserId')
    .all(routeHandler(offersPolicy.isAllowed))
    .get(routeHandler(offers.listOffersByUser));
  app
    .route('/api/offers')
    .all(routeHandler(offersPolicy.isAllowed))
    .get(routeHandler(offers.list))
    .post(routeHandler(offers.create));
  app
    .route('/api/offers/:offerId')
    .all(routeHandler(offersPolicy.isAllowed))
    .get(routeHandler(offers.getOffer))
    .delete(routeHandler(offers.delete))
    .put(routeHandler(offers.update));

  // Finish by binding the middleware
  app.param('offerUserId', parameterHandler(offers.offersByUserId));
  app.param('offerId', parameterHandler(offers.offerById));
}
export { register };
export default register;
export { register as 'module.exports' };

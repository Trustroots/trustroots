import type { Express, RequestHandler, RequestParamHandler } from 'express';

import referenceThreadPolicy from './../policies/reference-thread.server.policy.mts';
import referenceThread from './../controllers/reference-thread.server.controller.mjs';

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
    .route('/api/references-thread/:referenceThreadUserToId')
    .all(routeHandler(referenceThreadPolicy.isAllowed))
    .get(routeHandler(referenceThread.readReferenceThread));
  app
    .route('/api/references-thread')
    .all(routeHandler(referenceThreadPolicy.isAllowed))
    .post(routeHandler(referenceThread.createReferenceThread));

  // Finish by binding the middleware
  app.param(
    'referenceThreadUserToId',
    parameterHandler(referenceThread.readReferenceThreadById),
  );
}
export { register };
export default register;
export { register as 'module.exports' };

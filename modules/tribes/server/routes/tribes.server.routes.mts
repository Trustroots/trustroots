import type { Express, RequestHandler, RequestParamHandler } from 'express';

import tribesPolicy from './../policies/tribes.server.policy.mts';
import tribes from './../controllers/tribes.server.controller.mjs';

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
    .route('/api/tribes')
    .all(routeHandler(tribesPolicy.isAllowed))
    .get(routeHandler(tribes.listTribes));
  app
    .route('/api/tribes/:tribe/members')
    .all(routeHandler(tribesPolicy.isAllowed))
    .get(routeHandler(tribes.listMembers));
  app
    .route('/api/tribes/:tribe')
    .all(routeHandler(tribesPolicy.isAllowed))
    .get(routeHandler(tribes.getTribe));

  // Finish by binding the tribes middleware
  app.param('tribe', parameterHandler(tribes.tribeBySlug));
}
export { register };
export default register;
export { register as 'module.exports' };

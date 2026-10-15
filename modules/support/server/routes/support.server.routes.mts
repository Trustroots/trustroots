import type { Express, RequestHandler } from 'express';

import support from './../controllers/support.server.controller.mjs';
import targetedRequestLimit from '../../../core/server/middleware/targeted-request-limit.server.middleware.mjs';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;

/**
 * Module dependencies.
 */

const registerRoutes = function (app: Express) {
  app
    .route('/api/support')
    .post(
      routeHandler(targetedRequestLimit.support),
      routeHandler(support.supportRequest),
    );
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };

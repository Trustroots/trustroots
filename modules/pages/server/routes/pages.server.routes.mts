import type { Express, RequestHandler } from 'express';

import volunteers from './../controllers/pages.volunteers.server.controller.mts';
import greeters from './../controllers/pages.greeters.server.controller.mts';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;

/**
 * Public pages APIs (team volunteers, greeters roster). Not admin-only routes.
 */

const registerRoutes = (app: Express) => {
  app.route('/api/volunteers').get(routeHandler(volunteers.list));
  app.route('/api/greeters').get(routeHandler(greeters.list));
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };

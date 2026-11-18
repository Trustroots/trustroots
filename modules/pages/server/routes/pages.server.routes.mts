import type { Express, RequestHandler } from 'express';

import { list as listVolunteers } from './../controllers/pages.volunteers.server.controller.mts';
import { list as listGreeters } from './../controllers/pages.greeters.server.controller.mts';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;

/**
 * Public pages APIs (team volunteers, greeters roster). Not admin-only routes.
 */

const registerRoutes = (app: Express) => {
  app.route('/api/volunteers').get(routeHandler(listVolunteers));
  app.route('/api/greeters').get(routeHandler(listGreeters));
};
export default registerRoutes;

import type { Express, RequestHandler } from 'express';

import statistics from './../controllers/statistics.server.controller.mjs';
type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;

const defaultInterop = function (app: Express) {
  // Setting up the statistics api
  app
    .route('/api/statistics')
    .post(routeHandler(statistics.collectStatistics))
    .get(routeHandler(statistics.getPublicStatistics));
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };

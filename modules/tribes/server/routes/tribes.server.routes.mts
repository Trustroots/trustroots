import type { Express, RequestHandler, RequestParamHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { getClientIpAddress } from '../../../core/server/services/client-ip.server.service.mts';
import tribesPolicy from './../policies/tribes.server.policy.mts';
import tribes from './../controllers/tribes.server.controller.mts';
import { registerCircleChat } from '../controllers/circle-chat.server.controller.mts';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;
const parameterHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestParamHandler => callback as unknown as RequestParamHandler;
const disableDiscoveryCaching: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
};

/**
 * Module dependencies.
 */
function register(app: Express) {
  // Mount before the routes so the limit also applies before slug lookups.
  app.use(
    '/api/tribes',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      // Requests without a validated client address share one bucket.
      // Stryker disable next-line StringLiteral: the fallback label does not change the shared bucket's quota
      keyGenerator: req => ipKeyGenerator(getClientIpAddress(req) ?? 'unknown'),
      message: {
        message: 'Too many circle requests. Please try again shortly.',
      },
    }),
  );

  registerCircleChat(app);

  app
    .route('/api/tribes')
    .all(routeHandler(tribesPolicy.isAllowed))
    .get(routeHandler(tribes.listTribes));
  app
    .route('/api/tribes/discovery/connections')
    .all(routeHandler(tribesPolicy.isAllowed))
    .get(disableDiscoveryCaching, routeHandler(tribes.listConnections));
  app
    .route('/api/tribes/:tribe/members')
    .all(routeHandler(tribesPolicy.isAllowed))
    .get(disableDiscoveryCaching, routeHandler(tribes.listMembers));
  app
    .route('/api/tribes/:tribe')
    .all(routeHandler(tribesPolicy.isAllowed))
    .get(routeHandler(tribes.getTribe))
    .patch(disableDiscoveryCaching, routeHandler(tribes.editTribe));

  // This app-wide lookup also supplies circle page metadata and redirects.
  app.param('tribe', parameterHandler(tribes.tribeBySlug));
}
export { register };
export default register;

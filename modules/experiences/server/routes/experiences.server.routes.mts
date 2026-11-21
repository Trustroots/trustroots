import type { Express, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import config from '../../../../config/config.mts';
import { getClientIpAddress } from '../../../core/server/services/client-ip.server.service.mts';
import experiencesPolicy from '../policies/experiences.server.policy.mts';
import experiences from '../controllers/experiences.server.controller.mts';
import changes from '../controllers/experience-changes.server.controller.mts';

type MiddlewareCallback = (...args: never[]) => unknown;

// Route policies establish the request shape each narrower controller needs.
const routeHandler = <T extends MiddlewareCallback>(
  callback: T,
): RequestHandler => callback as unknown as RequestHandler;

function register(app: Express) {
  if (config.featureFlags.reference) {
    const experienceRateLimit = rateLimit({
      windowMs: 60_000,
      limit: config.experienceApiRequestsPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      // Requests without a validated client address share one bucket.
      // Stryker disable next-line StringLiteral: the fallback label does not change the shared bucket's quota
      keyGenerator: req => ipKeyGenerator(getClientIpAddress(req) ?? 'unknown'),
      message: {
        message: 'Too many experience requests. Please try again later.',
      },
    });

    const isAllowed = routeHandler(experiencesPolicy.isAllowed);
    const isAllowedChange = routeHandler(experiencesPolicy.isAllowedChange);

    app.post(
      '/api/experiences',
      experienceRateLimit,
      isAllowed,
      routeHandler(experiences.create),
    );
    app.get(
      '/api/experiences',
      experienceRateLimit,
      isAllowed,
      routeHandler(experiences.readMany),
    );
    app.get(
      '/api/experiences/count',
      experienceRateLimit,
      isAllowed,
      routeHandler(experiences.getCount),
    );
    app.get(
      '/api/experiences/suggestion',
      experienceRateLimit,
      isAllowed,
      routeHandler(experiences.getSuggestion),
    );
    app.get(
      '/api/experiences/reply-recipient/:recipientUsername',
      experienceRateLimit,
      isAllowed,
      routeHandler(experiences.readReplyRecipient),
    );
    app.get(
      '/api/my-experience',
      experienceRateLimit,
      isAllowed,
      routeHandler(experiences.readMine),
    );
    app.get(
      '/api/experiences/:experienceId',
      experienceRateLimit,
      isAllowed,
      routeHandler(experiences.experienceById),
      routeHandler(experiences.readOne),
    );
    app.get(
      '/api/experiences/:id/change-access',
      experienceRateLimit,
      isAllowedChange,
      routeHandler(changes.readAccess),
    );
    app.post(
      '/api/experiences/:id/change-requests',
      experienceRateLimit,
      isAllowedChange,
      routeHandler(changes.submit),
    );
    app.get(
      '/api/experiences/:id/change-requests/mine',
      experienceRateLimit,
      isAllowedChange,
      routeHandler(changes.readMine),
    );
  }
}
export { register };
export default register;

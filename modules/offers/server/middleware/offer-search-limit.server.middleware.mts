import type { Express, Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import config from '../../../../config/config.mts';

const searchLimits = new WeakMap<Express, RequestHandler>();

export function getOfferSearchLimit(app: Express): RequestHandler {
  const existingLimit = searchLimits.get(app);
  if (existingLimit) return existingLimit;

  const limit = rateLimit({
    windowMs: 60_000,
    limit: config.offerSearchRequestsPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Both route policies require a signed-in member before this middleware.
    keyGenerator: (req: Request & { user?: unknown }) =>
      (req.user as { id: string }).id,
    message: { message: 'Too many offer searches. Please try again shortly.' },
  });
  searchLimits.set(app, limit);
  return limit;
}

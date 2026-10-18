import config from '../../../../config/config.mts';
import { getClientIpAddress as defaultGetClientIpAddress } from '../services/client-ip.server.service.mts';
import defaultRequestLimitService from '../services/targeted-request-limits.server.service.mts';
type Operation =
  | 'signup'
  | 'support'
  | 'signin'
  | 'forgotPassword'
  | 'resetPassword'
  | 'resendConfirmation'
  | 'manageSessions'
  | 'avatarUpload';
interface LimitRequest {
  get?: (header: string) => string | undefined;
  ip?: string;
  user?: { id?: string };
  body?: { username?: unknown; email?: unknown };
  params?: { token?: unknown };
}
interface LimitResponse {
  status(code: number): LimitResponse;
  send(body: { message: string }): unknown;
  set(name: string, value: string): unknown;
}
interface LimitPolicy {
  enabled?: boolean;
  windowMs: number;
  ipLimit: number;
  identityLimit: number;
}
interface LimitDimension {
  name: string;
  value: string;
  limit: number;
}
interface LimitConsumeOptions {
  operation: Operation;
  dimensions: LimitDimension[];
  windowMs: number;
}
interface LimitDependencies {
  config?: { targetedRequestLimits: Partial<Record<Operation, LimitPolicy>> };
  getClientIpAddress?: (request: LimitRequest) => string | undefined;
  consume?: (
    options: LimitConsumeOptions,
  ) => Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}

function getRequestIdentity(
  req: Pick<LimitRequest, 'body' | 'user' | 'params'>,
  source: string,
): string | undefined {
  if (source === 'member') return req.user && req.user.id;
  if (source === 'account') {
    const handle = req.body && req.body.username;
    return typeof handle === 'string' ? handle.trim().toLowerCase() : undefined;
  }
  if (source === 'recipient') {
    const email = req.body && req.body.email;
    return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
  }
  if (source === 'token') {
    const token = req.params && req.params.token;
    return typeof token === 'string' ? token : undefined;
  }
  return undefined;
}

function createLimiter(
  operation: Operation,
  identitySource: string,
  {
    config: configOverride = config as NonNullable<LimitDependencies['config']>,
    getClientIpAddress = defaultGetClientIpAddress as (
      request: LimitRequest,
    ) => string | undefined,
    consume = (options: LimitConsumeOptions) =>
      defaultRequestLimitService.consume(options),
  }: LimitDependencies = {},
) {
  return async function targetedRequestLimit(
    req: LimitRequest,
    res: LimitResponse,
    next: () => void,
  ) {
    const policy = configOverride.targetedRequestLimits[operation];
    if (!policy || policy.enabled === false) return next();

    if (!Number.isSafeInteger(policy.windowMs) || policy.windowMs <= 0) {
      return res.status(503).send({
        message:
          'This service is temporarily unavailable. Please try again later.',
      });
    }

    const clientIp = getClientIpAddress(req);
    const hasIpLimit =
      Number.isSafeInteger(policy.ipLimit) && policy.ipLimit > 0;
    const hasIdentityLimit =
      Number.isSafeInteger(policy.identityLimit) && policy.identityLimit > 0;
    if (hasIpLimit && !clientIp) {
      return res.status(503).send({
        message:
          'This service is temporarily unavailable. Please try again later.',
      });
    }

    const identity = getRequestIdentity(req, identitySource);
    const dimensions: LimitDimension[] = [];

    if (clientIp && hasIpLimit) {
      dimensions.push({ name: 'ip', value: clientIp, limit: policy.ipLimit });
    }
    if (clientIp && identity && hasIdentityLimit) {
      dimensions.push({
        name: 'ip-and-identity',
        value: JSON.stringify([clientIp, identity]),
        limit: policy.identityLimit,
      });
    }
    if (
      (identitySource === 'member' || identitySource === 'recipient') &&
      identity &&
      hasIdentityLimit
    ) {
      dimensions.push({
        name: identitySource,
        value: identity,
        limit: policy.identityLimit,
      });
    }

    if (dimensions.length === 0) return next();

    try {
      const result = await consume({
        operation,
        dimensions,
        windowMs: policy.windowMs,
      });
      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfterSeconds));
        return res
          .status(429)
          .send({ message: 'Too many requests. Please try again later.' });
      }
      return next();
    } catch {
      // Do not let storage outages bypass abuse controls or expose identities.
      return res.status(503).send({
        message:
          'This service is temporarily unavailable. Please try again later.',
      });
    }
  };
}

function createTargetedRequestLimits(deps?: LimitDependencies) {
  return {
    signup: createLimiter('signup', 'recipient', deps),
    support: createLimiter('support', 'member', deps),
    signin: createLimiter('signin', 'account', deps),
    forgotPassword: createLimiter('forgotPassword', 'account', deps),
    resetPassword: createLimiter('resetPassword', 'token', deps),
    resendConfirmation: createLimiter('resendConfirmation', 'member', deps),
    manageSessions: createLimiter('manageSessions', 'member', deps),
    avatarUpload: createLimiter('avatarUpload', 'member', deps),
    getRequestIdentity,
  };
}

const defaultExport = createTargetedRequestLimits();
export default defaultExport;
export { createTargetedRequestLimits, getRequestIdentity };
export { defaultExport as 'module.exports' };

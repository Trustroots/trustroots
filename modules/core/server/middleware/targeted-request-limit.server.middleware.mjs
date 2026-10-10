import config from '../../../../config/config.mjs';
import { getClientIpAddress as defaultGetClientIpAddress } from '../services/client-ip.server.service.mjs';
import defaultRequestLimitService from '../services/targeted-request-limits.server.service.mjs';

function getRequestIdentity(req, source) {
  if (source === 'member') return req.user && req.user.id;
  if (source === 'account') {
    const handle = req.body && req.body.username;
    return typeof handle === 'string' ? handle.trim().toLowerCase() : undefined;
  }
  if (source === 'token') {
    const token = req.params && req.params.token;
    return typeof token === 'string' ? token : undefined;
  }
  if (source === 'mfaChallenge') {
    return req.session?.mfaChallenge?.userId;
  }
  return undefined;
}

function createLimiter(
  operation,
  identitySource,
  {
    config: configOverride = config,
    getClientIpAddress = defaultGetClientIpAddress,
    consume = (...args) => defaultRequestLimitService.consume(...args),
  } = {},
) {
  return async function targetedRequestLimit(req, res, next) {
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
    const dimensions = [];

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
      ['member', 'mfaChallenge'].includes(identitySource) &&
      identity &&
      hasIdentityLimit
    ) {
      dimensions.push({
        name: 'member',
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
    } catch (error) {
      // Do not let storage outages bypass abuse controls or expose identities.
      return res.status(503).send({
        message:
          'This service is temporarily unavailable. Please try again later.',
      });
    }
  };
}

function createTargetedRequestLimits(deps) {
  return {
    signin: createLimiter('signin', 'account', deps),
    forgotPassword: createLimiter('forgotPassword', 'account', deps),
    resetPassword: createLimiter('resetPassword', 'token', deps),
    mfaVerify: createLimiter('mfaVerify', 'mfaChallenge', deps),
    mfaManage: createLimiter('mfaManage', 'member', deps),
    resendConfirmation: createLimiter('resendConfirmation', 'member', deps),
    avatarUpload: createLimiter('avatarUpload', 'member', deps),
    getRequestIdentity,
  };
}

const defaultExport = createTargetedRequestLimits();
export default defaultExport;
export { createTargetedRequestLimits, getRequestIdentity };
export { defaultExport as 'module.exports' };

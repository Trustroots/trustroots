const config = require('../../../../config/config');
const { getClientIpAddress } = require('../services/client-ip.server.service');
const requestLimitService = require('../services/targeted-request-limits.server.service');

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
  return undefined;
}

function createLimiter(operation, identitySource) {
  return async function targetedRequestLimit(req, res, next) {
    const policy = config.targetedRequestLimits[operation];
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
    if (identitySource === 'member' && identity && hasIdentityLimit) {
      dimensions.push({
        name: 'member',
        value: identity,
        limit: policy.identityLimit,
      });
    }

    if (dimensions.length === 0) return next();

    try {
      const result = await requestLimitService.consume({
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

module.exports = {
  signin: createLimiter('signin', 'account'),
  forgotPassword: createLimiter('forgotPassword', 'account'),
  resetPassword: createLimiter('resetPassword', 'token'),
  resendConfirmation: createLimiter('resendConfirmation', 'member'),
  avatarUpload: createLimiter('avatarUpload', 'member'),
  getRequestIdentity,
};

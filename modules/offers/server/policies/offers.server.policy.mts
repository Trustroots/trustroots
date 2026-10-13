import memoryPolicy from './../../../core/server/services/memory-policy.server.service.mts';
import errorService from './../../../core/server/services/error.server.service.mjs';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';
type OffersRequest = PolicyRequest & {
  offer?: { user: unknown };
};

/**
 * Module dependencies.
 */
const acl = memoryPolicy();
const authoriseRoute = createRouteAuthorisation(acl, 'send');
/**
 * Invoke Offers Permissions
 */
function invokeRolesPolicies() {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/offers',
          permissions: '*',
        },
        {
          resources: '/api/offers-by/:offerUserId',
          permissions: '*',
        },
        {
          resources: '/api/offers/:offerId',
          permissions: '*',
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/offers',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/offers-by/:offerUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/offers/:offerId',
          permissions: ['get', 'put', 'delete'],
        },
      ],
    },
  ]);
}

/**
 * Check If Offers Policy Allows
 */
function isAllowed(req: OffersRequest, res: PolicyResponse, next: PolicyNext) {
  // No offers for non-authenticated nor for authenticated but un-published users
  if (!req.user || (req.user && !req.user.public)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an offer is being processed and the current user owns it, then allow any manipulation
  if (req.offer && req.user && req.offer.user === req.user._id) {
    return next();
  }
  return authoriseRoute(req, res, next);
}
const service = {
  invokeRolesPolicies,
  isAllowed,
};
export { invokeRolesPolicies, isAllowed };
export default service;

// Expose the ACL dependency for native ESM boundary stubs.
export { acl as _acl };
export { service as 'module.exports' };

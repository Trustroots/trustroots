import memoryPolicy from './../../../core/server/services/memory-policy.server.service.mts';
import errorService from './../../../core/server/services/error.server.service.mjs';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';
type ReferenceThreadRequest = PolicyRequest & {
  referenceThread?: { userFrom: { equals(id: unknown): boolean } };
};

/**
 * Module dependencies.
 */
const acl = memoryPolicy();
const authoriseRoute = createRouteAuthorisation(acl, 'send');
/**
 * Invoke References Permissions
 */
function invokeRolesPolicies() {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/references-thread',
          permissions: ['post'],
        },
        {
          resources: '/api/references-thread/:referenceThreadUserToId',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/references-thread',
          permissions: ['post'],
        },
        {
          resources: '/api/references-thread/:referenceThreadUserToId',
          permissions: ['get'],
        },
      ],
    },
  ]);
}

/**
 * Check If References Policy Allows
 */
function isAllowed(
  req: ReferenceThreadRequest,
  res: PolicyResponse,
  next: PolicyNext,
) {
  // No references for non-authenticated users
  // No reference writing for authenticated but un-published users, except if they're reading existing reference
  if (
    !req.user ||
    (req.user && !req.user.public && req.method.toLowerCase() !== 'get')
  ) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an referenceThread is being processed and the current user "owns" it, then allow any manipulation
  if (
    req.referenceThread &&
    req.user &&
    req.referenceThread.userFrom.equals(req.user._id)
  ) {
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

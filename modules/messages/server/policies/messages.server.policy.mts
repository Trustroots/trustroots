import memoryPolicy from './../../../core/server/services/memory-policy.server.service.mts';
import errorService from './../../../core/server/services/error.server.service.mjs';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';

/**
 * Module dependencies.
 */
const acl = memoryPolicy();
const authoriseRoute = createRouteAuthorisation(acl);
/**
 * Invoke Messages Permissions
 */
function invokeRolesPolicies() {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/messages-hosting',
          permissions: ['get'],
        },
        {
          resources: '/api/messages',
          permissions: [],
        },
        {
          resources: '/api/messages/:messageUserId',
          permissions: [],
        },
        {
          resources: '/api/messages-preview',
          permissions: ['post'],
        },
        {
          resources: '/api/messages-read',
          permissions: [],
        },
        {
          resources: '/api/messages-count',
          permissions: [],
        },
        {
          resources: '/api/messages-sync',
          permissions: [],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/messages-hosting',
          permissions: ['get'],
        },
        {
          resources: '/api/messages',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/messages/:messageUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/messages-preview',
          permissions: ['post'],
        },
        {
          resources: '/api/messages-read',
          permissions: ['post'],
        },
        {
          resources: '/api/messages-count',
          permissions: ['get'],
        },
        {
          resources: '/api/messages-sync',
          permissions: ['get'],
        },
      ],
    },
  ]);
}

/**
 * Check If Messages Policy Allows
 */
function isAllowed(req: PolicyRequest, res: PolicyResponse, next: PolicyNext) {
  // No messages feature for un-published users
  if (req.user && req.user.public !== true) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
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

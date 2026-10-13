import memoryPolicy from './../../../core/server/services/memory-policy.server.service.mts';
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
const authoriseRoute = createRouteAuthorisation(acl, 'send');
/**
 * Invoke Tribes Permissions
 */
function invokeRolesPolicies() {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/tribes',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe/members',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/tribes',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe/members',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['guest'],
      allows: [
        {
          resources: '/api/tribes',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe',
          permissions: ['get'],
        },
      ],
    },
  ]);
}

/**
 * Check If Tribes Policy Allows
 */
function isAllowed(req: PolicyRequest, res: PolicyResponse, next: PolicyNext) {
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

import memoryPolicy from './../../../core/server/services/memory-policy.server.service.mjs';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mjs';
const service = {};

/**
 * Module dependencies.
 */
const acl = memoryPolicy();
const authoriseRoute = createRouteAuthorisation(acl, 'send');
/**
 * Invoke Tribes Permissions
 */
service.invokeRolesPolicies = function () {
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
};

/**
 * Check If Tribes Policy Allows
 */
service.isAllowed = function (req, res, next) {
  return authoriseRoute(req, res, next);
};
const invokeRolesPolicies = service.invokeRolesPolicies;
const isAllowed = service.isAllowed;
export { invokeRolesPolicies, isAllowed };
export default service;

// Expose the ACL dependency for native ESM boundary stubs.
export { acl as _acl };
export { service as 'module.exports' };

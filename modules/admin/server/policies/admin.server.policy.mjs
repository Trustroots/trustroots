/**
 * Module dependencies.
 */
import createMemoryPolicy from './../../../core/server/services/memory-policy.server.service.mjs';
import _ from 'lodash';
import errorService from './../../../core/server/services/error.server.service.mjs';
const aclInstance = createMemoryPolicy();

/**
 * Invoke Users Permissions
 */
export const invokeRolesPolicies = () => {
  aclInstance.allow([
    {
      roles: ['welcome-team'],
      allows: [
        {
          resources: '/api/admin/acquisition-stories',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/acquisition-stories/analysis',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/staff-blockers',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/admin/acquisition-stories',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/acquisition-stories/analysis',
          permissions: ['post'],
        },
        { resources: '/api/admin/staff-blockers', permissions: ['get'] },
        { resources: '/api/admin/audit-log', permissions: ['get'] },
        { resources: '/api/admin/audit-log/actors', permissions: ['get'] },
        { resources: '/api/admin/dashboard', permissions: ['get'] },
        { resources: '/api/admin/messages', permissions: ['post'] },
        {
          resources: '/api/admin/messages/scammer-recipients',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/messages/scammer-warning',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/threads',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/notes',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/admin/user',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/user/change-role',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/users',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/users/by-role',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/users/by-last-ip-address',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/reference-threads',
          permissions: ['get'],
        },
        {
          resources: '/api/admin/newsletter-subscribers',
          permissions: ['get'],
        },
        {
          resources: '/api/admin/newsletter-subscribers/circle',
          permissions: ['get'],
        },
        {
          resources: '/api/admin/newsletter-subscribers/audience',
          permissions: ['post'],
        },
        {
          resources: '/api/admin/newsletter-subscribers/split',
          permissions: ['post'],
        },
      ],
    },
  ]);
};

/**
 * Check If Users Policy Allows
 */
export const isAllowed = (req, res, next) => {
  // Check for user roles
  const roles = _.get(req, ['user', 'roles'], ['guest']);
  aclInstance.areAnyRolesAllowed(
    roles,
    req.route.path,
    req.method.toLowerCase(),
    (err, isAllowed) => {
      if (err) {
        // An authorization error occurred.
        return res.status(500).send({
          message: 'Unexpected authorization error',
        });
      } else {
        if (isAllowed) {
          // Access granted! Invoke next middleware
          return next();
        } else {
          return res.status(403).json({
            message: errorService.getErrorMessageByKey('forbidden'),
          });
        }
      }
    },
  );
};
const defaultInterop = {
  invokeRolesPolicies,
  isAllowed,
};
export default defaultInterop; // Expose the ACL instance only to native ESM tests; the CommonJS API stays unchanged.
export { aclInstance as _acl };
export { defaultInterop as 'module.exports' };

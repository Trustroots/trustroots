import memoryPolicy0 from '../../../core/server/services/memory-policy.server.service.js';
import errorService from '../../../core/server/services/error.server.service.js';

const service = {};

/**
 * Module dependencies.
 */
const acl = memoryPolicy0();
/**
 * Invoke Messages Permissions
 */
service.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/messages',
          permissions: [],
        },
        {
          resources: '/api/messages/:messageUserId',
          permissions: [],
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
          resources: '/api/messages',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/messages/:messageUserId',
          permissions: ['get'],
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
};

/**
 * Check If Messages Policy Allows
 */
service.isAllowed = function (req, res, next) {
  // No messages feature for un-published users
  if (req.user && req.user.public !== true) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Check for user roles
  const roles = req.user && req.user.roles ? req.user.roles : ['guest'];
  acl.areAnyRolesAllowed(
    roles,
    req.route.path,
    req.method.toLowerCase(),
    function (err, isAllowed) {
      if (err) {
        // An authorization error occurred.
        return res.status(500).json({
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

const namedExport0 = service.invokeRolesPolicies;
const namedExport1 = service.isAllowed;
export { namedExport0 as invokeRolesPolicies, namedExport1 as isAllowed };
export default service;

// Expose the ACL dependency for native ESM boundary stubs.
export { acl as _acl };

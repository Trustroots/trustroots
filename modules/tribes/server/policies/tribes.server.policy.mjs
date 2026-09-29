import memoryPolicy from '../../../core/server/services/memory-policy.server.service.js';
import errorService from '../../../core/server/services/error.server.service.js';

const service = {};

/**
 * Module dependencies.
 */
const acl = memoryPolicy();
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
  // Check for user roles
  const roles = req.user && req.user.roles ? req.user.roles : ['guest'];
  acl.areAnyRolesAllowed(
    roles,
    req.route.path,
    req.method.toLowerCase(),
    function (err, isAllowed) {
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

const invokeRolesPolicies = service.invokeRolesPolicies;
const isAllowed = service.isAllowed;
export { invokeRolesPolicies as invokeRolesPolicies, isAllowed as isAllowed };
export default service;

// Expose the ACL dependency for native ESM boundary stubs.
export { acl as _acl };

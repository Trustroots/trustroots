/**
 * Module dependencies.
 */
const acl = require('acl');
const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

// Using the memory backend
const aclInstance = new acl(new acl.memoryBackend());

/**
 * Invoke Users Permissions
 */
exports.invokeRolesPolicies = () => {
  aclInstance.allow([
    {
      roles: ['admin'],
      allows: [
        { resources: '/api/admin/acquisition-stories', permissions: ['post'] },
        {
          resources: '/api/admin/acquisition-stories/analysis',
          permissions: ['post'],
        },
        { resources: '/api/admin/audit-log', permissions: ['get'] },
        { resources: '/api/admin/messages', permissions: ['post'] },
        { resources: '/api/admin/threads', permissions: ['post'] },
        { resources: '/api/admin/notes', permissions: ['get', 'post'] },
        { resources: '/api/admin/user', permissions: ['post'] },
        { resources: '/api/admin/user/change-role', permissions: ['post'] },
        { resources: '/api/admin/users', permissions: ['post'] },
        { resources: '/api/admin/users/by-role', permissions: ['post'] },
        { resources: '/api/admin/reference-threads', permissions: ['get'] },
        {
          resources: '/api/admin/newsletter-subscribers',
          permissions: ['get'],
        },
      ],
    },
  ]);
};

/**
 * Check If Users Policy Allows
 */
exports.isAllowed = (req, res, next) => {
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

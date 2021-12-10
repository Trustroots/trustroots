/**
 * Module dependencies.
 */
let acl = require('acl');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Tribes Permissions
 */
exports.invokeRolesPolicies = function () {
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
exports.isAllowed = function (req, res, next) {
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

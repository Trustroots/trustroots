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
 * Invoke References Permissions
 */
exports.invokeRolesPolicies = function () {
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
};

/**
 * Check If References Policy Allows
 */
exports.isAllowed = function (req, res, next) {
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

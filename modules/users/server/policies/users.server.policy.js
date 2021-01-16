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
 * Invoke Users Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/users',
          permissions: [],
        },
        {
          resources: '/api/users/:username',
          permissions: [],
        },
        {
          resources: '/api/users/avatar',
          permissions: [],
        },
        {
          resources: '/api/users/mini/:userId',
          permissions: [],
        },
        {
          resources: '/api/users/password',
          permissions: [],
        },
        {
          resources: '/api/auth/accounts',
          permissions: [],
        },
        {
          resources: '/api/users/memberships',
          permissions: [],
        },
        {
          resources: '/api/users/memberships/:tribeId',
          permissions: [],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/users',
          permissions: ['get', 'put', 'delete'],
        },
        {
          resources: '/api/users/remove/:token',
          permissions: ['delete'],
        },
        {
          resources: '/api/users/:username',
          permissions: ['get'],
        },
        {
          resources: '/api/users/:avatarUserId/avatar',
          permissions: ['get'],
        },
        {
          resources: '/api/users-avatar',
          permissions: ['post'],
        },
        {
          resources: '/api/users/mini/:userId',
          permissions: ['get'],
        },
        {
          resources: '/api/users/password',
          permissions: ['post'],
        },
        {
          resources: '/api/auth/accounts',
          permissions: ['get', 'post', 'delete'],
        },
        {
          resources: '/api/auth/twitter',
          permissions: ['get'],
        },
        {
          resources: '/api/auth/twitter/callback',
          permissions: ['get'],
        },
        {
          resources: '/api/auth/facebook',
          permissions: ['get', 'put'],
        },
        {
          resources: '/api/auth/facebook/callback',
          permissions: ['get'],
        },
        {
          resources: '/api/auth/github',
          permissions: ['get'],
        },
        {
          resources: '/api/auth/github/callback',
          permissions: ['get'],
        },
        {
          resources: '/api/users/memberships',
          permissions: ['get'],
        },
        {
          resources: '/api/users/memberships/:tribeId',
          permissions: ['post', 'delete'],
        },
        {
          resources: '/api/users/push/registrations',
          permissions: ['post'],
        },
        {
          resources: '/api/users/push/registrations/:token',
          permissions: ['delete'],
        },
        {
          resources: '/api/blocked-users',
          permissions: ['get'],
        },
        {
          resources: '/api/blocked-users/:username',
          permissions: ['put', 'delete'],
        },
      ],
    },
  ]);
};

/**
 * Check If Users Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  // Non-public profiles are invisible
  if (
    req.profile &&
    !req.profile.public &&
    req.user &&
    !req.profile._id.equals(req.user._id)
  ) {
    return res.status(404).json({
      message: errorService.getErrorMessageByKey('not-found'),
    });
  }

  // No profile browsing for non-public users
  if (
    req.profile &&
    req.user &&
    !req.user.public &&
    !req.profile._id.equals(req.user._id)
  ) {
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
        // An authorization error occurred
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

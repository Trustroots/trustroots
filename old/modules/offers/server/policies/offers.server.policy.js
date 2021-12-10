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
 * Invoke Offers Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/offers',
          permissions: '*',
        },
        {
          resources: '/api/offers-by/:offerUserId',
          permissions: '*',
        },
        {
          resources: '/api/offers/:offerId',
          permissions: '*',
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/offers',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/offers-by/:offerUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/offers/:offerId',
          permissions: ['get', 'put', 'delete'],
        },
      ],
    },
  ]);
};

/**
 * Check If Offers Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  // No offers for non-authenticated nor for authenticated but un-published users
  if (!req.user || (req.user && !req.user.public)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an offer is being processed and the current user owns it, then allow any manipulation
  if (req.offer && req.user && req.offer.user === req.user._id) {
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

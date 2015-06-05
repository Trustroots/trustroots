'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl');

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Offers Permissions
 */
exports.invokeRolesPolicies = function() {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: '/api/offers',
      permissions: '*'
    }, {
      resources: '/api/offers-by/:userId',
      permissions: '*'
    }, {
      resources: '/api/offers/:offerId',
      permissions: '*'
    }]
  }, {
    roles: ['user'],
    allows: [{
      resources: '/api/offers',
      permissions: ['get']
    }, {
      resources: '/api/offers-by/:userId',
      permissions: ['get']
    }, {
      resources: '/api/offers/:offerId',
      permissions: ['get']
    }]
  }]);
};


/**
 * Check If Offers Policy Allows
 */
exports.isAllowed = function(req, res, next) {

  // No offers for un-published users
  if(req.user && req.user.public !== true) {
    return res.status(403).json({
      message: 'User is not authorized'
    });
  }

  // If an offer is being processed and the current user owns it, then allow any manipulation
  if(req.offer && req.user && req.offer.user.id === req.user.id) {
    return next();
  }

  // Check for user roles
  var roles = (req.user && req.user.roles) ? req.user.roles : ['guest'];
  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function(err, isAllowed) {
    if(err) {
      // An authorization error occurred.
      return res.status(500).send('Unexpected authorization error');
    } else {
      if(isAllowed) {
        // Access granted! Invoke next middleware
        return next();
      } else {
        return res.status(403).json({
          message: 'User is not authorized'
        });
      }
    }
  });
};

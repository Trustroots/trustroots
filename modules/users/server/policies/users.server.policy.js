'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl');

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Users Permissions
 */
exports.invokeRolesPolicies = function() {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: '/api/users',
      permissions: []
    }, {
      resources: '/api/users/:username',
      permissions: []
    }, {
      resources: '/api/users/accounts',
      permissions: []
    }, {
      resources: '/api/users/avatar',
      permissions: []
    }, {
      resources: '/api/users/mini/:userId',
      permissions: []
    }, {
      resources: '/api/users/password',
      permissions: []
    }]
  }, {
    roles: ['user'],
    allows: [{
      resources: '/api/users',
      permissions: ['put']
    }, {
      resources: '/api/users/:username',
      permissions: ['get']
    }, {
      resources: '/api/users/accounts',
      permissions: ['delete']
    }, {
      resources: '/api/users-avatar',
      permissions: ['post']
    }, {
      resources: '/api/users/mini/:userId',
      permissions: ['get']
    }, {
      resources: '/api/users/password',
      permissions: ['post']
    }, {
      resources: '/api/auth/twitter',
      permissions: ['get']
    }, {
      resources: '/api/auth/twitter/callback',
      permissions: ['get']
    }, {
      resources: '/api/auth/facebook',
      permissions: ['get']
    }, {
      resources: '/api/auth/facebook/callback',
      permissions: ['get']
    }, {
      resources: '/api/auth/github',
      permissions: ['get']
    }, {
      resources: '/api/auth/github/callback',
      permissions: ['get']
    }]
  }]);
};


/**
 * Check If Users Policy Allows
 */
exports.isAllowed = function(req, res, next) {

  // Non-public profiles are invisible
  if(req.profile && !req.profile.public && req.user && req.profile._id.toString() !== req.user._id.toString()) {

    return res.status(404).json({
      message: 'Not found.'
    });
  }

  // No profile browsing for non-public users
  if(req.profile && req.user && req.user.public !== true && req.profile._id.toString() !== req.user._id.toString()) {

    return res.status(403).json({
      message: 'User is not authorized'
    });
  }

  // Check for user roles
  var roles = (req.user && req.user.roles) ? req.user.roles : ['guest'];
  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function(err, isAllowed) {
    if (err) {
      // An authorization error occurred.
      return res.status(500).send('Unexpected authorization error');
    } else {
      if (isAllowed) {
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

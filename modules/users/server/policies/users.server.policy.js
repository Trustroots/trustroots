'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl'),
    path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller'));

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
      resources: '/api/users/avatar',
      permissions: []
    }, {
      resources: '/api/users/mini/:userId',
      permissions: []
    }, {
      resources: '/api/users/password',
      permissions: []
    }, {
      resources: '/api/auth/accounts',
      permissions: []
    }, {
      resources: '/api/users/memberships',
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
      resources: '/api/users-avatar',
      permissions: ['post']
    }, {
      resources: '/api/users/mini/:userId',
      permissions: ['get']
    }, {
      resources: '/api/users/password',
      permissions: ['post']
    }, {
      resources: '/api/auth/accounts',
      permissions: ['get', 'post', 'delete']
    }, {
      resources: '/api/auth/twitter',
      permissions: ['get']
    }, {
      resources: '/api/auth/twitter/callback',
      permissions: ['get']
    }, {
      resources: '/api/auth/facebook',
      permissions: ['get', 'put']
    }, {
      resources: '/api/auth/facebook/callback',
      permissions: ['get']
    }, {
      resources: '/api/auth/github',
      permissions: ['get']
    }, {
      resources: '/api/auth/github/callback',
      permissions: ['get']
    }, {
      resources: '/api/users/memberships/:type?',
      permissions: ['post', 'get']
    }]
  }]);
};


/**
 * Check If Users Policy Allows
 */
exports.isAllowed = function(req, res, next) {

  // Non-public profiles are invisible
  if (req.profile && !req.profile.public && req.user && !req.profile._id.equals(req.user._id)) {
    console.log('Non-public profiles are invisible');
    return res.status(404).json({
      message: errorHandler.getErrorMessageByKey('not-found')
    });
  }

  // No profile browsing for non-public users
  if (req.profile && req.user && !req.user.public && !req.profile._id.equals(req.user._id)) {
    console.log('No profile browsing for non-public users');
    return res.status(403).json({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Check for user roles
  var roles = (req.user && req.user.roles) ? req.user.roles : ['guest'];
  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function(err, isAllowed) {
    if (err) {
      // An authorization error occurred.
      return res.status(500).json({
        message: 'Unexpected authorization error'
      });
    } else {
      if (isAllowed) {
        // Access granted! Invoke next middleware
        return next();
      } else {
        console.log('->policy 403');
        return res.status(403).json({
          message: errorHandler.getErrorMessageByKey('forbidden')
        });
      }
    }
  });
};

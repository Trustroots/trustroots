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
 * Invoke Tags Permissions
 */
exports.invokeRolesPolicies = function() {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: '/api/tags',
      permissions: ['get', 'post']
    }, {
      resources: '/api/tags/:tagSlug',
      permissions: ['get']
    }, {
      resources: '/api/tribes',
      permissions: ['get']
    }, {
      resources: '/api/tribes/:tribeSlug',
      permissions: ['get']
    }]
  }, {
    roles: ['user'],
    allows: [{
      resources: '/api/tags',
      permissions: ['get']
    }, {
      resources: '/api/tags/:tagSlug',
      permissions: ['get']
    }, {
      resources: '/api/tribes',
      permissions: ['get']
    }, {
      resources: '/api/tribes/:tribeSlug',
      permissions: ['get']
    }]
  }, {
    roles: ['guest'],
    allows: [{
      resources: '/api/tags',
      permissions: ['get']
    }, {
      resources: '/api/tags/:tagSlug',
      permissions: ['get']
    }, {
      resources: '/api/tribes',
      permissions: ['get']
    }, {
      resources: '/api/tribes/:tribeSlug',
      permissions: ['get']
    }]
  }]);
};


/**
 * Check If Tags Policy Allows
 */
exports.isAllowed = function(req, res, next) {

  // No tags/tribes for non-authenticated users
  /*
  if(!req.user || (req.user && !req.user.public)) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }
  */

  // Check for user roles
  var roles = (req.user && req.user.roles) ? req.user.roles : ['guest'];
  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function(err, isAllowed) {

    if(err) {
      // An authorization error occurred.
      return res.status(500).send({
        message: 'Unexpected authorization error'
      });
    } else {
      if(isAllowed) {
        // Access granted! Invoke next middleware
        return next();
      } else {
        return res.status(403).json({
          message: errorHandler.getErrorMessageByKey('forbidden')
        });
      }
    }
  });
};

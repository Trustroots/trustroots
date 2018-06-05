'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl'),
    path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service'));

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke References Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: '/api/references/:referencesUserToId',
      permissions: ['get', 'post']
    }]
  }, {
    roles: ['user'],
    allows: [{
      resources: '/api/references/:referencesUserToId',
      permissions: ['get', 'post']
    }]
  }]);
};


/**
 * Check If References Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  // No references for non-authenticated users
  // No reference writing for authenticated but un-published users
  if (!req.user || (req.user && !req.user.public)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Check for user roles
  var roles = (req.user && req.user.roles) ? req.user.roles : ['guest'];
  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function (err, isAllowed) {

    if (err) {
      // An authorization error occurred.
      return res.status(500).send({
        message: 'Unexpected authorization error'
      });
    } else {
      if (isAllowed) {
        // Access granted! Invoke next middleware
        return next();
      } else {
        return res.status(403).json({
          message: errorService.getErrorMessageByKey('forbidden')
        });
      }
    }
  });
};

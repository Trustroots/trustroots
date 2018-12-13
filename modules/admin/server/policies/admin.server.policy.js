'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl'),
    path = require('path');

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Users Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([{
    roles: ['admin'],
    allows: [
      { resources: '/api/admin/users', permissions: ['get'] }
    ]
  }]);
};

/**
 * Check If Users Policy Allows
 */
exports.isAllowed = function (req, res, next) {

  return next();
};

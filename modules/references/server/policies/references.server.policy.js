'use strict';

var acl = require('acl'),
    path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service'));

acl = new acl(new acl.memoryBackend());

exports.invokeRolesPolicies = function () {
  acl.allow([{
    roles: ['user', 'admin'],
    allows: [{
      resources: '/api/references',
      permissions: ['post']
    }]
  }]);
};

exports.isAllowed = function (req, res, next) {

  var roles = (req.user && req.user.roles) ? req.user.roles : ['guest'];

  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function (err, isAllowed) {
    if (err) {

    } else {
      if (isAllowed && req.user.public) {
        // Access granted! Invoke next middleware
        return next();
      }

      return res.status(403).json({
        message: errorService.getErrorMessageByKey('forbidden')
      });
    }
  });
};

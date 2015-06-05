'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl');

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Contacts Permissions
 */
exports.invokeRolesPolicies = function() {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: '/api/contact',
      permissions: []
    }, {
      resources: '/api/contact-by/:userId',
      permissions: []
    }, {
      resources: '/api/contact/:contactId',
      permissions: []
    }, {
      resources: '/api/contacts/:listUserId',
      permissions: []
    }]
  }, {
    roles: ['user'],
    allows: [{
      resources: '/api/contact',
      permissions: ['post']
    }, {
      resources: '/api/contact-by/:userId',
      permissions: ['get']
    }, {
      resources: '/api/contact/:contactId',
      permissions: ['get', 'put', 'delete']
    }, {
      resources: '/api/contacts/:listUserId',
      permissions: ['get']
    }]
  }]);
};


/**
 * Check If Contacts Policy Allows
 */
exports.isAllowed = function(req, res, next) {

  // No contacts for un-published users
  if(req.user && req.user.public !== true) {
    return res.status(403).json({
      message: 'User is not authorized'
    });
  }

  // If an contact is being processed and the current user owns it, then allow any manipulation
  if (req.contact && req.user && req.contact.users.indexOf(req.user.id) > -1) {
    return next();
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

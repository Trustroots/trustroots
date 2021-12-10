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
 * Invoke Contacts Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/contact',
          permissions: [],
        },
        {
          resources: '/api/contact-by/:contactUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contact/:contactId',
          permissions: ['get'],
        },
        {
          resources: '/api/contacts/:listUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contacts/:listUserId/common',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/contact',
          permissions: ['post'],
        },
        {
          resources: '/api/contact-by/:contactUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contact/:contactId',
          permissions: ['get', 'put'],
        },
        {
          resources: '/api/contacts/:listUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contacts/:listUserId/common',
          permissions: ['get'],
        },
      ],
    },
  ]);
};

/**
 * Check If Contacts Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  // No contacts for un-published users
  if (req.user && req.user.public !== true) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an contact is being processed and the current user is
  // other party of the connection, then allow any manipulation
  // 'Delete' gets allowed here
  if (
    req.contact &&
    req.user &&
    (req.contact.userFrom._id.equals(req.user._id.valueOf()) ||
      req.contact.userTo._id.equals(req.user._id.valueOf()))
  ) {
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

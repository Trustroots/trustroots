/**
 * Module dependencies.
 */
const acl =
  require('../../../core/server/services/memory-policy.server.service')();
const errorService = require('../../../core/server/services/error.server.service');
const {
  createRouteAuthorisation,
} = require('../../../core/server/services/route-authorisation.server.service');
const authoriseRoute = createRouteAuthorisation(acl);

/**
 * Invoke Messages Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/messages',
          permissions: [],
        },
        {
          resources: '/api/messages/:messageUserId',
          permissions: [],
        },
        {
          resources: '/api/messages-read',
          permissions: [],
        },
        {
          resources: '/api/messages-count',
          permissions: [],
        },
        {
          resources: '/api/messages-sync',
          permissions: [],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/messages',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/messages/:messageUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/messages-read',
          permissions: ['post'],
        },
        {
          resources: '/api/messages-count',
          permissions: ['get'],
        },
        {
          resources: '/api/messages-sync',
          permissions: ['get'],
        },
      ],
    },
  ]);
};

/**
 * Check If Messages Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  // No messages feature for un-published users
  if (req.user && req.user.public !== true) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  return authoriseRoute(req, res, next);
};

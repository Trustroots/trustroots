/**
 * Module dependencies.
 */
const acl =
  require('../../../core/server/services/memory-policy.server.service')();
const {
  createRouteAuthorisation,
} = require('../../../core/server/services/route-authorisation.server.service');
const authoriseRoute = createRouteAuthorisation(acl, 'send');

/**
 * Invoke Tribes Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/tribes',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/tribes',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['guest'],
      allows: [
        {
          resources: '/api/tribes',
          permissions: ['get'],
        },
        {
          resources: '/api/tribes/:tribe',
          permissions: ['get'],
        },
      ],
    },
  ]);
};

/**
 * Check If Tribes Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  return authoriseRoute(req, res, next);
};

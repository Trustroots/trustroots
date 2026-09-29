/**
 * Module dependencies.
 */
const acl =
  require('../../../core/server/services/memory-policy.server.service')();
const errorService = require('../../../core/server/services/error.server.service');
const {
  createRouteAuthorisation,
} = require('../../../core/server/services/route-authorisation.server.service');
const authoriseRoute = createRouteAuthorisation(acl, 'send');

/**
 * Invoke References Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/references-thread',
          permissions: ['post'],
        },
        {
          resources: '/api/references-thread/:referenceThreadUserToId',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/references-thread',
          permissions: ['post'],
        },
        {
          resources: '/api/references-thread/:referenceThreadUserToId',
          permissions: ['get'],
        },
      ],
    },
  ]);
};

/**
 * Check If References Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  // No references for non-authenticated users
  // No reference writing for authenticated but un-published users, except if they're reading existing reference
  if (
    !req.user ||
    (req.user && !req.user.public && req.method.toLowerCase() !== 'get')
  ) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an referenceThread is being processed and the current user "owns" it, then allow any manipulation
  if (
    req.referenceThread &&
    req.user &&
    req.referenceThread.userFrom.equals(req.user._id)
  ) {
    return next();
  }

  return authoriseRoute(req, res, next);
};

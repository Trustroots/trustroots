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
 * Invoke Offers Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/offers',
          permissions: '*',
        },
        {
          resources: '/api/offers-by/:offerUserId',
          permissions: '*',
        },
        {
          resources: '/api/offers/:offerId',
          permissions: '*',
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/offers',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/offers-by/:offerUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/offers/:offerId',
          permissions: ['get', 'put', 'delete'],
        },
      ],
    },
  ]);
};

/**
 * Check If Offers Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  // No offers for non-authenticated nor for authenticated but un-published users
  if (!req.user || (req.user && !req.user.public)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an offer is being processed and the current user owns it, then allow any manipulation
  if (req.offer && req.user && req.offer.user === req.user._id) {
    return next();
  }

  return authoriseRoute(req, res, next);
};

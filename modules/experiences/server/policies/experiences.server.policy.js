const acl =
  require('../../../core/server/services/memory-policy.server.service')();
const errorService = require('../../../core/server/services/error.server.service');

exports.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['user', 'admin'],
      allows: [
        {
          resources: '/api/experiences',
          permissions: ['get', 'post'],
        },
        {
          resources: '/api/experiences/count',
          permissions: ['get'],
        },
        {
          resources: '/api/experiences/suggestion',
          permissions: ['get'],
        },
        {
          resources: '/api/my-experience',
          permissions: ['get'],
        },
        {
          resources: '/api/experiences/:experienceId',
          permissions: ['get'],
        },
        {
          resources: '/api/experiences/:id/change-access',
          permissions: ['get'],
        },
        {
          resources: '/api/experiences/:id/change-requests',
          permissions: ['post'],
        },
        {
          resources: '/api/experiences/:id/change-requests/mine',
          permissions: ['get'],
        },
      ],
    },
  ]);
};

exports.isAllowed = async function (req, res, next) {
  try {
    const roles = req.user && req.user.roles ? req.user.roles : ['guest'];

    const isAllowed = await acl.areAnyRolesAllowed(
      roles,
      req.route.path,
      req.method.toLowerCase(),
    );

    if (isAllowed && req.user.public) {
      // Access granted! Invoke next middleware
      return next();
    }

    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  } catch (e) {
    return next(e);
  }
};

exports.isAllowedChange = async function (req, res, next) {
  try {
    const roles = req.user && req.user.roles ? req.user.roles : ['guest'];
    if (
      req.user &&
      (await acl.areAnyRolesAllowed(
        roles,
        req.route.path,
        req.method.toLowerCase(),
      ))
    ) {
      return next();
    }
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  } catch (error) {
    return next(error);
  }
};

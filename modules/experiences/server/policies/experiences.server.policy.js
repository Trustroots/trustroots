let acl = require('acl');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

acl = new acl(new acl.memoryBackend());

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
          resources: '/api/my-experience',
          permissions: ['get'],
        },
        {
          resources: '/api/experiences/:experienceId',
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

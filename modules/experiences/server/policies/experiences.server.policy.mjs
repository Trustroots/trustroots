import memoryPolicy from '../../../core/server/services/memory-policy.server.service.js';
import errorService from '../../../core/server/services/error.server.service.js';

const service = {};

const acl = memoryPolicy();
service.invokeRolesPolicies = function () {
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
      ],
    },
  ]);
};

service.isAllowed = async function (req, res, next) {
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

const invokeRolesPolicies = service.invokeRolesPolicies;
const isAllowed = service.isAllowed;
export { invokeRolesPolicies as invokeRolesPolicies, isAllowed as isAllowed };
export default service;

// Expose the ACL dependency for native ESM boundary stubs.
export { acl as _acl };

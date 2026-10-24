import memoryPolicy from './../../../core/server/services/memory-policy.server.service.mts';
import errorService from './../../../core/server/services/error.server.service.mjs';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';
const acl = memoryPolicy();
function invokeRolesPolicies() {
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
          resources: '/api/experiences/reply-recipient/:recipientUsername',
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
}
async function isAllowed(
  req: PolicyRequest,
  res: PolicyResponse,
  next: PolicyNext,
) {
  try {
    const roles = req.user && req.user.roles ? req.user.roles : ['guest'];
    const isAllowed = await acl.areAnyRolesAllowed(
      roles,
      req.route.path,
      req.method.toLowerCase(),
    );
    if (isAllowed && req.user!.public) {
      // Access granted! Invoke next middleware
      return next();
    }
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  } catch (e) {
    return next(e);
  }
}

async function isAllowedChange(
  req: PolicyRequest,
  res: PolicyResponse,
  next: PolicyNext,
) {
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
}

const service = {
  invokeRolesPolicies,
  isAllowed,
  isAllowedChange,
};
export { invokeRolesPolicies, isAllowed, isAllowedChange };
export default service;

// Expose the ACL dependency for native ESM boundary stubs.
export { acl as _acl };
export { service as 'module.exports' };

import errorService from './error.server.service.mjs';
import type {
  MemoryPolicy,
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from './policy-types.server.mts';

/** Each policy retains its own grants and performs domain checks first. */
export const createRouteAuthorisation = function (
  acl: MemoryPolicy,
  errorMethod: 'json' | 'send' = 'json',
) {
  return function authoriseRoute(
    req: PolicyRequest,
    res: PolicyResponse,
    next: PolicyNext,
  ): unknown {
    let roles = req.user && req.user.roles ? req.user.roles : ['guest'];
    const hasPrivilegedRole = roles.includes('admin');
    if (
      hasPrivilegedRole &&
      (req.user?.mfaEnabled !== true || req.user.$locals?.mfaVerified !== true)
    ) {
      // Admin never reaches the ACL until this session has completed a second
      // factor. The member can still access ordinary account routes.
      roles = roles.filter(role => role !== 'admin');
      if (!roles.includes('user')) roles.push('user');
    }
    return acl.areAnyRolesAllowed(
      roles,
      req.route.path,
      req.method.toLowerCase(),
      function (err, isAllowed) {
        if (err) {
          return res.status(500)[errorMethod]({
            message: 'Unexpected authorization error',
          });
        }
        if (isAllowed) {
          return next();
        }
        return res.status(403).json({
          message: errorService.getErrorMessageByKey('forbidden'),
        });
      },
    );
  };
};

const service = { createRouteAuthorisation };
export default service;
export { service as 'module.exports' };

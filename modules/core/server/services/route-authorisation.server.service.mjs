import errorService from './error.server.service.mjs';

/** Each policy retains its own grants and performs domain checks first. */
export const createRouteAuthorisation = function (acl, errorMethod = 'json') {
  return function authoriseRoute(req, res, next) {
    let roles = req.user && req.user.roles ? req.user.roles : ['guest'];
    const hasPrivilegedRole = roles.some(role =>
      ['admin', 'moderator', 'welcome-team'].includes(role),
    );
    if (
      hasPrivilegedRole &&
      (req.user.mfaEnabled !== true || req.user.$locals?.mfaVerified !== true)
    ) {
      // Privileged roles never reach the ACL until this session has completed
      // a second factor. The member can still access ordinary account routes.
      roles = roles.filter(
        role => !['admin', 'moderator', 'welcome-team'].includes(role),
      );
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

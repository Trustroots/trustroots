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
    const roles = req.user && req.user.roles ? req.user.roles : ['guest'];
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
/** @commonjs */
export { service as 'module.exports' };

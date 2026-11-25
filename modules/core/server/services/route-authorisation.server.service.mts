import errorService from './error.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from './policy-types.server.mts';

/** Route path → role → the lower-case HTTP methods that role may call. */
export type RouteGrants = Record<string, Record<string, readonly string[]>>;

/** Signed-out requests act as `guest`; any one granting role is enough. */
export function isRouteAllowed(grants: RouteGrants, req: PolicyRequest) {
  const path = req.route.path;
  const methodsByRole = Object.hasOwn(grants, path) ? grants[path] : {};
  const method = req.method.toLowerCase();
  return (req.user?.roles ?? ['guest']).some(
    role =>
      Object.hasOwn(methodsByRole, role) &&
      methodsByRole[role].includes(method),
  );
}

export function createRouteAuthorisation(grants: RouteGrants) {
  return function authoriseRoute(
    req: PolicyRequest,
    res: PolicyResponse,
    next: PolicyNext,
  ): unknown {
    if (isRouteAllowed(grants, req)) {
      return next();
    }
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  };
}

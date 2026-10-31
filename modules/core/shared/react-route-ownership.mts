import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router';

export type ReactRoutePolicy = {
  path: string;
  title: string;
  footerHidden?: boolean;
  footerVariant?: string;
  headerHidden?: boolean;
  noScrollingTop?: boolean;
  redirectTo?: string;
  requiresAuth?: boolean;
  requiresAuthParams?: Record<string, readonly string[]>;
  requiresRole?: string | readonly string[];
};

export type ReactRouteMatch = {
  params: Record<string, string>;
  policy: ReactRoutePolicy;
};

export type ReactRouteUser = {
  roles?: readonly string[];
};

export const NOT_FOUND_ROUTE_POLICY: ReactRoutePolicy = {
  path: '/not-found',
  title: 'Not found',
  footerVariant: 'account',
  headerHidden: true,
};

export function toTanStackPath(path: string): string {
  return path
    .split('/')
    .map(segment =>
      segment.startsWith(':') ? `$${segment.slice(1)}` : segment,
    )
    .join('/');
}

let policyRouter: AnyRouter;
let policyByRouteId: Map<string, ReactRoutePolicy>;

// Modules own their policies; the shell composes and registers them.
export function setReactRoutePolicies(policies: ReactRoutePolicy[]) {
  const policyRootRoute = createRootRoute();
  const policyRouteEntries = policies.map(policy => ({
    policy,
    route: createRoute({
      getParentRoute: () => policyRootRoute,
      path: toTanStackPath(policy.path),
    }),
  }));
  policyRouter = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: policyRootRoute.addChildren(
      policyRouteEntries.map(({ route }) => route),
    ),
  });
  policyByRouteId = new Map(
    policyRouteEntries.map(({ policy, route }) => [route.id, policy]),
  );
}

export function normalizePath(path: string): string {
  const parsedPath = (path || '/').split('?')[0].split('#')[0] || '/';

  if (parsedPath.length > 1 && parsedPath.endsWith('/')) {
    return parsedPath.slice(0, -1);
  }

  return parsedPath;
}

export function matchReactRoute(path: string): ReactRouteMatch | null {
  const normalizedPath = normalizePath(path);
  const circleMatch = /^\/circles\/([^/]+)$/.exec(normalizedPath);
  if (normalizedPath.startsWith('/circles/') && !circleMatch) {
    return null;
  }
  if (circleMatch) {
    let circle;
    try {
      circle = decodeURIComponent(circleMatch[1] ?? '');
    } catch {
      circle = '';
    }
    if (!/^[a-z0-9-]+$/.test(circle)) {
      return { params: {}, policy: NOT_FOUND_ROUTE_POLICY };
    }
  }
  const matches = policyRouter.matchRoutes(normalizedPath);
  const match = matches?.[matches.length - 1];
  const policy = match && policyByRouteId.get(match.routeId);

  return policy
    ? {
        params: match.params,
        policy,
      }
    : null;
}

export function getReactRoutePolicy(path: string): ReactRoutePolicy | null {
  return matchReactRoute(path)?.policy ?? null;
}

export function isReactOwnedPath(path: string): boolean {
  return Boolean(getReactRoutePolicy(path));
}

export function userHasRequiredRole(
  user: ReactRouteUser | null | undefined,
  requiredRole: ReactRoutePolicy['requiresRole'],
): boolean {
  if (!requiredRole) {
    return false;
  }

  const roles =
    typeof requiredRole === 'string' ? [requiredRole] : requiredRole;
  return roles.some(role => (user?.roles ?? []).includes(role));
}

export function routeRequiresAuth(
  route: ReactRoutePolicy | null | undefined,
  path?: string,
): boolean {
  if (!route) {
    return false;
  }

  if (route.requiresAuth || route.requiresRole) {
    return true;
  }

  if (!route.requiresAuthParams) {
    return false;
  }

  const params = matchReactRoute(path ?? '/')?.params || {};

  return Object.entries(route.requiresAuthParams).some(([param, values]) =>
    values.includes(params[param]),
  );
}

export function getReactRouteAccessRedirect(
  route: ReactRoutePolicy | null | undefined,
  user: ReactRouteUser | null | undefined,
  returnTo?: string,
): string | null {
  if (!route) {
    return null;
  }

  if (routeRequiresAuth(route, returnTo) && !user) {
    if (returnTo) {
      return `/signin?continue=true&returnTo=${encodeURIComponent(returnTo)}`;
    }

    return '/signin';
  }

  if (route.requiresRole && !userHasRequiredRole(user, route.requiresRole)) {
    return '/volunteering';
  }

  return null;
}

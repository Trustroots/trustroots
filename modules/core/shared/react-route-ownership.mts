import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
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

const ADMIN_ROUTE_DEFAULTS = {
  footerVariant: 'admin',
  requiresAuth: true,
  requiresRole: 'admin',
};

const ACCOUNT_ACCESS_FOOTER = { footerVariant: 'account' };

export const REACT_ROUTE_POLICIES: ReactRoutePolicy[] = [
  {
    path: '/',
    title: 'Home',
    footerHidden: true,
  },
  {
    path: '/about',
    title: 'About',
    footerHidden: true,
    redirectTo: '/',
  },
  {
    path: '/contact',
    title: 'Contact us',
  },
  {
    path: '/contribute',
    title: 'Contribute',
  },
  {
    path: '/faq',
    title: 'FAQ - Site & community',
  },
  {
    path: '/faq/bugs-and-features',
    title: 'FAQ - Bugs & Features',
  },
  {
    path: '/faq/circles',
    title: 'FAQ - Circles',
  },
  {
    path: '/faq/foundation',
    title: 'FAQ - Foundation',
  },
  {
    path: '/faq/technology',
    title: 'FAQ - Technology',
  },
  {
    path: '/foundation',
    title: 'Foundation',
  },
  {
    path: '/guide',
    title: 'Guide',
  },
  {
    path: '/media',
    title: 'Media',
  },
  {
    path: '/navigation',
    title: 'Navigation',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/not-found',
    title: 'Not found',
    ...ACCOUNT_ACCESS_FOOTER,
    headerHidden: true,
  },
  {
    path: '/privacy',
    title: 'Privacy policy',
  },
  {
    path: '/rules',
    title: 'Rules',
  },
  {
    path: '/safety',
    title: 'Safety',
  },
  {
    path: '/statistics',
    title: 'Statistics',
  },
  {
    path: '/support',
    title: 'Support',
  },
  {
    path: '/team',
    title: 'Team',
  },
  {
    path: '/team/greeters',
    title: 'Trustroots greeters',
  },
  {
    path: '/volunteering',
    title: 'Volunteering',
  },
  {
    path: '/welcome',
    title: 'Welcome',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/circles',
    title: 'Circles',
  },
  {
    path: '/circles/:circle',
    title: 'Circle',
    footerVariant: 'circle',
    requiresAuthParams: {
      circle: ['naturists'],
    },
  },
  {
    path: '/messages',
    title: 'Messages',
    requiresAuth: true,
  },
  {
    path: '/messages/:username',
    title: 'Messages',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/search',
    title: 'Search',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/search/members',
    title: 'Search members',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/profile/:username/experiences/new',
    title: 'Share your experience',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/experiences/:id/change',
    title: 'Change an Experience',
    requiresAuth: true,
  },
  {
    path: '/profile/:username/experiences',
    title: 'Experiences',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/accommodation',
    title: 'Profile accommodation',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/about',
    title: 'Profile',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/overview',
    title: 'Profile overview',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/contacts',
    title: 'Profile contacts',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username/tribes',
    title: 'Profile tribes',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/:username',
    title: 'Profile',
    requiresAuth: true,
    noScrollingTop: true,
  },
  {
    path: '/profile/edit/locations',
    title: 'Edit your locations',
    requiresAuth: true,
  },
  {
    path: '/profile/edit/photo',
    title: 'Edit profile photo',
    requiresAuth: true,
  },
  {
    path: '/profile/edit/networks',
    title: 'Edit Profile networks',
    requiresAuth: true,
  },
  {
    path: '/profile/edit/account',
    title: 'Account',
    requiresAuth: true,
  },
  {
    path: '/profile/edit',
    title: 'Edit profile',
    requiresAuth: true,
  },
  {
    path: '/contact-add/:userId',
    title: 'Add contact',
    requiresAuth: true,
  },
  {
    path: '/contact-confirm/:contactId',
    title: 'Confirm contact',
    requiresAuth: true,
  },
  {
    path: '/offer',
    title: 'Host travellers',
    requiresAuth: true,
  },
  {
    path: '/offer/host',
    title: 'Host travellers',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/offer/meet',
    title: 'Meet',
    requiresAuth: true,
  },
  {
    path: '/offer/meet/add',
    title: 'Add meeting offer',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/offer/meet/:offerId',
    title: 'Edit meeting offer',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/signin',
    title: 'Sign in',
    headerHidden: true,
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/signup',
    title: 'Sign up',
    headerHidden: true,
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/confirm-email/:token',
    title: 'Confirm email',
  },
  {
    path: '/confirm-email-invalid',
    title: 'Confirm email invalid',
  },
  {
    path: '/password/forgot',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/password/reset/invalid',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/password/reset/success',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/password/reset/:token',
    title: 'Reset password',
    ...ACCOUNT_ACCESS_FOOTER,
  },
  {
    path: '/remove/:token',
    title: 'Remove profile',
    requiresAuth: true,
    headerHidden: true,
    footerHidden: true,
  },
  {
    path: '/profile-signup',
    title: 'Trustroots profile',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin',
    title: 'Admin',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/support',
    requiresRole: ['admin', 'support-team'],
    title: 'Support',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/support/member/:username',
    requiresRole: ['admin', 'support-team'],
    title: 'Support - Member',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/hackerspaces',
    title: 'Admin - Hackerspaces',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/audit-log',
    title: 'Admin - Audit log',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/username-changes',
    requiresRole: ['admin'],
    title: 'Admin - Username changes',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/acquisition-stories',
    requiresRole: ['admin', 'welcome-team', 'support-team'],
    title: 'Admin - Acquisition stories',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/staff-blockers',
    requiresRole: ['admin', 'welcome-team', 'support-team'],
    title: 'Admin - Staff blockers',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/location-corrections',
    requiresRole: ['admin', 'welcome-team'],
    title: 'Welcome team - Location corrections',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/messages',
    title: 'Admin - Messages',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/threads',
    title: 'Admin - Threads',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/search-users',
    title: 'Admin - Search users',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/user',
    title: 'Admin - User',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/user/:username',
    title: 'Admin - User',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/reference-threads',
    title: 'Admin - Reference threads',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/experience-changes',
    requiresRole: ['admin', 'support-team'],
    title: 'Admin - Experience changes',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/newsletter',
    title: 'Admin - Newsletter',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/circles',
    title: 'Admin - Circles',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/circles/:circle',
    title: 'Admin - Circle',
  },
];

export const REACT_OWNED_PATHS = REACT_ROUTE_POLICIES.map(route => route.path);

export function toTanStackPath(path: string): string {
  return path
    .split('/')
    .map(segment =>
      segment.startsWith(':') ? `$${segment.slice(1)}` : segment,
    )
    .join('/');
}

const policyRootRoute = createRootRoute();
const policyRouteEntries = REACT_ROUTE_POLICIES.map(policy => ({
  policy,
  route: createRoute({
    getParentRoute: () => policyRootRoute,
    path: toTanStackPath(policy.path),
  }),
}));
const policyRouter = createRouter({
  history: createMemoryHistory({ initialEntries: ['/'] }),
  routeTree: policyRootRoute.addChildren(
    policyRouteEntries.map(({ route }) => route),
  ),
});
const policyByRouteId = new Map(
  policyRouteEntries.map(({ policy, route }) => [route.id, policy]),
);

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
      const policy = REACT_ROUTE_POLICIES.find(
        route => route.path === '/not-found',
      );

      return policy ? { params: {}, policy } : null;
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

const reactRouteOwnership = {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  matchReactRoute,
  REACT_ROUTE_POLICIES,
  REACT_OWNED_PATHS,
  isReactOwnedPath,
  normalizePath,
  routeRequiresAuth,
  toTanStackPath,
  userHasRequiredRole,
};

export default reactRouteOwnership;

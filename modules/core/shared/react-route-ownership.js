const {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} = require('@tanstack/react-router');

const ADMIN_ROUTE_DEFAULTS = {
  footerVariant: 'admin',
  requiresAuth: true,
  requiresRole: 'admin',
};

const REACT_ROUTE_POLICIES = [
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
    footerHidden: true,
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
    footerHidden: true,
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
  },
  {
    path: '/profile/:username/experiences/new',
    title: 'Share your experience',
    requiresAuth: true,
    noScrollingTop: true,
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
    footerHidden: true,
  },
  {
    path: '/signup',
    title: 'Sign up',
    headerHidden: true,
    footerHidden: true,
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
    footerHidden: true,
  },
  {
    path: '/password/reset/invalid',
    title: 'Reset password',
    footerHidden: true,
  },
  {
    path: '/password/reset/success',
    title: 'Reset password',
    footerHidden: true,
  },
  {
    path: '/password/reset/:token',
    title: 'Reset password',
    footerHidden: true,
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
    path: '/admin/audit-log',
    title: 'Admin - Audit log',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/acquisition-stories',
    title: 'Admin - Acquisition stories',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/acquisition-stories/analysis',
    title: 'Admin - Acquisition stories analysis',
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
    path: '/admin/reference-threads',
    title: 'Admin - Reference threads',
  },
  {
    ...ADMIN_ROUTE_DEFAULTS,
    path: '/admin/newsletter',
    title: 'Admin - Newsletter',
  },
];

const REACT_OWNED_PATHS = REACT_ROUTE_POLICIES.map(route => route.path);

function toTanStackPath(path) {
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

function normalizePath(path) {
  const parsedPath = (path || '/').split('?')[0].split('#')[0] || '/';

  if (parsedPath.length > 1 && parsedPath.endsWith('/')) {
    return parsedPath.slice(0, -1);
  }

  return parsedPath;
}

function matchReactRoute(path) {
  const normalizedPath = normalizePath(path);
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

function getReactRoutePolicy(path) {
  return matchReactRoute(path)?.policy ?? null;
}

function isReactOwnedPath(path) {
  return Boolean(getReactRoutePolicy(path));
}

function userHasRequiredRole(user, requiredRole) {
  return Boolean(requiredRole && (user?.roles || []).includes(requiredRole));
}

function getReactRouteAccessRedirect(route, user, returnTo) {
  if (!route) {
    return null;
  }

  if ((route.requiresAuth || route.requiresRole) && !user) {
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

module.exports = {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  matchReactRoute,
  REACT_ROUTE_POLICIES,
  REACT_OWNED_PATHS,
  isReactOwnedPath,
  normalizePath,
  toTanStackPath,
  userHasRequiredRole,
};

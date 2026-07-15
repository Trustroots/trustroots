const ADMIN_ROUTE_DEFAULTS = {
  footerVariant: 'admin',
  requiresAuth: true,
  requiresRole: 'admin',
};

const REACT_ROUTE_POLICIES = [
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
    path: '/privacy',
    title: 'Privacy policy',
  },
  {
    path: '/rules',
    title: 'Rules',
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

function normalizePath(path) {
  const parsedPath = (path || '/').split('?')[0].split('#')[0] || '/';

  if (parsedPath.length > 1 && parsedPath.endsWith('/')) {
    return parsedPath.slice(0, -1);
  }

  return parsedPath;
}

function getReactRoutePolicy(path) {
  const normalizedPath = normalizePath(path);

  return REACT_ROUTE_POLICIES.find(route => route.path === normalizedPath);
}

function isReactOwnedPath(path) {
  return Boolean(getReactRoutePolicy(path));
}

function userHasRequiredRole(user, requiredRole) {
  return Boolean(requiredRole && (user?.roles || []).includes(requiredRole));
}

function getReactRouteAccessRedirect(route, user) {
  if (!route) {
    return null;
  }

  if ((route.requiresAuth || route.requiresRole) && !user) {
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
  REACT_ROUTE_POLICIES,
  REACT_OWNED_PATHS,
  isReactOwnedPath,
  normalizePath,
  userHasRequiredRole,
};

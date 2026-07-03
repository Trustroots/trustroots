import {
  findRoute,
  isReactRoute,
  routes,
} from '@/modules/core/client/react-app/routes';
import {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
  REACT_OWNED_PATHS,
  REACT_ROUTE_POLICIES,
  normalizePath,
} from '@/modules/core/shared/react-route-ownership';

describe('React route ownership', () => {
  it('keeps the React route table aligned with the shared ownership list', () => {
    expect(routes.map(route => route.path).sort()).toEqual(
      [...REACT_OWNED_PATHS].sort(),
    );
  });

  it('defines a renderer for every React-owned route policy', () => {
    routes.forEach(route => {
      expect(route.render).toEqual(expect.any(Function));
    });
  });

  it('normalizes paths before ownership checks', () => {
    expect(normalizePath('/support/?report=alice')).toBe('/support');
    expect(isReactRoute('/support/?report=alice')).toBe(true);
    expect(findRoute('/support/?report=alice').title).toBe('Support');
  });

  it('keeps the shared route policy aligned with owned paths', () => {
    expect(REACT_ROUTE_POLICIES.map(route => route.path).sort()).toEqual(
      [...REACT_OWNED_PATHS].sort(),
    );
    expect(getReactRoutePolicy('/admin/')).toMatchObject({
      footerHidden: true,
      path: '/admin',
      requiresAuth: true,
      requiresRole: 'admin',
      title: 'Admin',
    });
  });

  it('defines admin route metadata and renderers', () => {
    const adminRoute = findRoute('/admin/audit-log');

    expect(adminRoute).toMatchObject({
      footerHidden: true,
      path: '/admin/audit-log',
      requiresAuth: true,
      requiresRole: 'admin',
      title: 'Admin - Audit log',
    });
    expect(adminRoute.render).toEqual(expect.any(Function));
  });

  it('returns access redirects for protected route policies', () => {
    const route = getReactRoutePolicy('/admin');

    expect(getReactRouteAccessRedirect(route, null)).toBe('/signin');
    expect(getReactRouteAccessRedirect(route, { roles: ['user'] })).toBe(
      '/volunteering',
    );
    expect(
      getReactRouteAccessRedirect(route, { roles: ['user', 'admin'] }),
    ).toBe(null);
    expect(
      getReactRouteAccessRedirect(getReactRoutePolicy('/support'), null),
    ).toBe(null);
  });

  it('does not claim Angular-owned paths', () => {
    expect(isReactRoute('/profile/alice')).toBe(false);
    expect(findRoute('/profile/alice')).toBe(undefined);
  });
});

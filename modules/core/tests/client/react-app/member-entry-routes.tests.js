import { findRoute } from '@/modules/core/client/react-app/routes';
import { getReactRouteAccessRedirect } from '@/modules/core/shared/react-route-ownership';
describe('Member entry routes', () => {
  it.each(['/welcome', '/navigation', '/search/members'])(
    'retains access and presentation rules for %s',
    path => {
      const route = findRoute(path);
      expect(route.footerHidden).toBe(true);
      expect(getReactRouteAccessRedirect(route, null)).toBe('/signin');
      expect(
        getReactRouteAccessRedirect(route, { roles: ['user'] }),
      ).toBeNull();
    },
  );
});

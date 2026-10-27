import { findRoute } from '@/layers/shell/client/routes';
import { getReactRouteAccessRedirect } from '@/modules/core/shared/react-route-ownership.mts';

describe('Member entry routes', () => {
  it.each(['/welcome', '/navigation', '/search/members'])(
    'retains access and presentation rules for %s',
    (path: string) => {
      const route = findRoute(path)!;
      expect(route.footerHidden).toBe(true);
      expect(getReactRouteAccessRedirect(route, null)).toBe('/signin');
      expect(
        getReactRouteAccessRedirect(route, { roles: ['user'] }),
      ).toBeNull();
    },
  );
});

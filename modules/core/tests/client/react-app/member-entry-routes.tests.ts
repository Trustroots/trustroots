import {
  getReactRouteAccessRedirect,
  getReactRoutePolicy,
} from '@/modules/core/shared/react-route-ownership.mts';

describe('Member entry routes', () => {
  it.each(['/welcome', '/navigation', '/search/members'])(
    'retains access and presentation rules for %s',
    (path: string) => {
      const route = getReactRoutePolicy(path)!;
      expect(route.footerHidden).toBe(true);
      expect(getReactRouteAccessRedirect(route, null)).toBe('/signin');
      expect(
        getReactRouteAccessRedirect(route, { roles: ['user'] }),
      ).toBeNull();
    },
  );
});

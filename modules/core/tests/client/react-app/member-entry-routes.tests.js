import '@/modules/users/client/users.client.module';
import '@/modules/pages/client/pages.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';
import { findRoute } from '@/modules/core/client/react-app/routes';
import { getReactRouteAccessRedirect } from '@/modules/core/shared/react-route-ownership';

describe('Member entry route transitions', () => {
  beforeEach(angular.mock.module(AppConfig.appModuleName));
  beforeEach(
    angular.mock.module($urlRouterProvider =>
      $urlRouterProvider.deferIntercept(),
    ),
  );

  it.each([
    ['welcome', '/welcome'],
    ['navigation', '/navigation'],
    ['search-users', '/search/members'],
  ])('loads the React root from the %s Angular state', (name, path) => {
    inject(($state, $injector) => {
      const $window = { location: { assign: jest.fn() } };
      const state = $state.get(name);
      expect(state.template).toBeUndefined();
      expect(state.requiresAuth).toBe(true);
      $injector.invoke(state.onEnter, null, { $window, $stateParams: {} });
      expect($window.location.assign).toHaveBeenCalledWith(path);
    });
  });

  it('encodes a member-search query when entering from Angular', () => {
    inject(($state, $injector) => {
      const $window = { location: { assign: jest.fn() } };
      $injector.invoke($state.get('search-users').onEnter, null, {
        $window,
        $stateParams: { search: 'Sample & Member' },
      });
      expect($window.location.assign).toHaveBeenCalledWith(
        '/search/members?search=Sample%20%26%20Member',
      );
    });
  });

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

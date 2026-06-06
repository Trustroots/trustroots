import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-page-title.client.directive';

describe('trPageTitle directive', function () {
  let $compile;
  let $rootScope;
  let $state;
  let $window;

  beforeEach(
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $window = {
        title: 'Trustroots',
      };

      $provide.value('$window', $window);
    }),
  );

  beforeEach(inject(function (_$compile_, _$rootScope_, _$state_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $state = _$state_;
  }));

  function compileTemplate() {
    $state.$current = {
      locals: {
        globals: {
          username: 'alice',
        },
      },
    };

    const scope = $rootScope.$new();
    const element = $compile('<h1 tr-page-title></h1>')(scope);
    scope.$digest();

    return { element, scope };
  }

  it('appends configured page title and app name on state change', function () {
    const { element } = compileTemplate();

    $rootScope.$broadcast('$stateChangeSuccess', {
      data: {
        pageTitle: 'Profile {{username}}',
      },
    });

    expect(element.html()).toBe('Profile alice - Trustroots');
  });

  it('falls back to window title when no page title is configured', function () {
    const { element } = compileTemplate();

    $rootScope.$broadcast('$stateChangeSuccess', {
      data: {},
    });

    expect(element.html()).toBe('Trustroots');
  });
});

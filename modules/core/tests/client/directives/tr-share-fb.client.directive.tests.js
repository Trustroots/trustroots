import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-share-fb.client.directive';

describe('trShareFb directive', function () {
  let $compile;
  let $rootScope;
  let $window;
  let Authentication;
  let originalGlobalFB;

  beforeEach(
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      Authentication = {
        user: {
          additionalProvidersData: {},
        },
      };

      $window = {
        location: {
          href: 'https://trustroots.org/profile/alice',
        },
        FB: undefined,
      };

      $provide.value('Authentication', Authentication);
      $provide.value('$window', $window);
    }),
  );

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    originalGlobalFB = global.FB;
    delete global.FB;
  }));

  afterEach(function () {
    if (typeof originalGlobalFB === 'undefined') {
      delete global.FB;
    } else {
      global.FB = originalGlobalFB;
    }
  });

  function compile() {
    const scope = $rootScope.$new();
    const element = $compile('<div tr-share-fb></div>')(scope);
    scope.$digest();
    return { element, scope };
  }

  it('does nothing when user is not connected to Facebook', function () {
    const { element } = compile();
    expect(element.html()).toBe('');
  });

  it('renders share markup immediately when FB API is present', function () {
    Authentication.user.additionalProvidersData.facebook = {
      id: 'fb-user',
    };
    global.FB = $window.FB = {
      XFBML: {
        parse: jasmine.createSpy('parse'),
      },
    };

    const { element } = compile();

    expect($window.FB.XFBML.parse).toHaveBeenCalledWith(
      jasmine.any(HTMLDivElement),
    );
    expect(element.html()).toContain('fb-share-button');
    expect(element.html()).toContain(
      'https://www.facebook.com/sharer/sharer.php?u=',
    );
  });

  it('waits for facebookReady when FB API is not yet loaded', function () {
    Authentication.user.additionalProvidersData.facebook = {
      id: 'fb-user',
    };
    const parse = jasmine.createSpy('parse');
    const { element } = compile();

    global.FB = $window.FB = {
      XFBML: {
        parse,
      },
    };
    $rootScope.$broadcast('facebookReady');
    $rootScope.$digest();

    expect(parse).toHaveBeenCalledWith(jasmine.any(HTMLDivElement));
    expect(element.html()).toContain('fb-share-button');
  });
});

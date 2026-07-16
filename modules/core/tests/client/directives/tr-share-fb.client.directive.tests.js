import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-share-fb.client.directive';

describe('trShareFb directive', function () {
  let $compile;
  let $rootScope;
  let $window;
  let Authentication;

  beforeEach(
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      Authentication = {
        user: {
          additionalProvidersData: {},
        },
      };

      $window = {
        location: {
          href: 'https://trustroots.org/profile/fictional-member',
        },
      };

      $provide.value('Authentication', Authentication);
      $provide.value('$window', $window);
    }),
  );

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile() {
    const scope = $rootScope.$new();
    const element = $compile('<div tr-share-fb></div>')(scope);
    scope.$digest();
    return element;
  }

  it('does nothing when user is not connected to Facebook', function () {
    expect(compile().html()).toBe('');
  });

  it('renders a direct share link without the Facebook SDK', function () {
    Authentication.user.additionalProvidersData.facebook = {
      id: 'fictional-facebook-id',
    };

    const link = compile().find('a');

    expect(link.attr('href')).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=' +
        encodeURIComponent($window.location.href),
    );
    expect(link.attr('target')).toBe('_blank');
    expect(link.attr('rel')).toBe('noopener');
  });
});

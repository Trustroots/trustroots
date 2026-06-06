import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-board-credits.client.directive';

describe('trBoardCredits directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(app) {
    const scope = $rootScope.$new();
    scope.app = app;

    const element = $compile('<div tr-board-credits></div>')(scope);
    scope.$digest();

    return { element, scope };
  }

  it('hides credits when count is zero', function () {
    const { element } = compile({
      photoCreditsCount: 0,
      photoCredits: {
        hero: {
          name: 'Nora',
          url: 'https://example.com/nora',
        },
      },
    });

    expect(element.children().length).toBe(0);
  });

  it('renders singular photo credit without license', function () {
    const { element } = compile({
      photoCreditsCount: 1,
      photoCredits: {
        hero: {
          name: 'Nora',
          url: 'https://example.com/nora',
        },
      },
    });

    const links = element.find('a');

    expect(element.text()).toContain('Photo by');
    expect(links.length).toBe(1);
    expect(links.eq(0).attr('href')).toBe('https://example.com/nora');
    expect(links.eq(0).text()).toBe('Nora');
    expect(element.find('span[aria-label="License"]').length).toBe(0);
  });

  it('renders plural credits with comma separation and license links', function () {
    const { element } = compile({
      photoCreditsCount: 2,
      photoCredits: {
        hero: {
          name: 'Nora',
          url: 'https://example.com/nora',
          license: 'CC',
          license_url: 'https://creativecommons.org/licenses/by/4.0/',
        },
        guest: {
          name: 'Leo',
          url: 'https://example.com/leo',
        },
      },
    });

    const licenseLink = element.find('span > a[aria-label="License"]');

    expect(element.text()).toContain('Photos by');
    expect(licenseLink.length).toBe(1);
    expect(element.text()).toContain('Nora');
    expect(element.text()).toContain('Leo');
    expect(element.html()).toContain(', ');
  });
});

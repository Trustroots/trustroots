import AppConfig from '@/modules/core/client/app/config';
import '@/modules/users/client/users.client.module';

describe('tr-monkeybox directive', function () {
  let $compile;
  let $rootScope;
  let Languages;

  beforeEach(function () {
    Languages = {
      get: jasmine.createSpy('Languages.get').and.returnValue({
        en: 'English',
        fi: 'Suomi',
      }),
    };

    angular.mock.module(AppConfig.appModuleName);

    angular.mock.module(function ($provide) {
      $provide.value('Languages', Languages);
    });
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compileDirective(profile) {
    const scope = $rootScope.$new();
    scope.profile = profile;

    const element = $compile('<div tr-monkeybox profile="profile"></div>')(
      scope,
    );
    scope.$digest();

    return {
      element,
      scope: element.isolateScope(),
    };
  }

  it('maps language keys to names from Languages service', function () {
    const { element } = compileDirective({
      _id: 'alice',
      displayName: 'Alice',
      languages: ['en', 'es'],
      member: [],
    });

    expect(Languages.get).toHaveBeenCalledWith('object');
    expect(element.text()).toContain('English');
    expect(element.text()).toContain('es');
  });

  it('renders only fallback codes for missing translations', function () {
    const { element } = compileDirective({
      _id: 'alice',
      displayName: 'Alice',
      languages: ['jp'],
      member: [],
    });

    expect(element.text()).toContain('jp');
    expect(element.text()).not.toContain('English');
  });

  it('does not show language section when no languages are provided', function () {
    const { element } = compileDirective({
      _id: 'alice',
      displayName: 'Alice',
      languages: [],
      member: [],
    });

    expect(element.text()).not.toContain('Languages');
  });

  it('stores resolved language map on the isolate scope', function () {
    const { scope } = compileDirective({
      _id: 'alice',
      displayName: 'Alice',
      languages: [],
      member: [],
    });

    expect(scope.languageNames).toEqual({
      en: 'English',
      fi: 'Suomi',
    });
  });
});

import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-switch.client.directive';

describe('trSwitch directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(attributes = '') {
    const element = $compile(
      `<label tr-switch ${attributes}><input type="checkbox"></label>`,
    )($rootScope.$new());
    $rootScope.$digest();

    return element;
  }

  it('adds the base switch class and toggle element', function () {
    const element = compile();

    expect(element.hasClass('tr-switch')).toBe(true);
    expect(element.hasClass('tr-switch-sm')).toBe(false);
    expect(element[0].querySelector('.toggle')).not.toBeNull();
    expect(element[0].querySelector('input').nextSibling).toHaveClass('toggle');
  });

  it('adds the small switch class when requested', function () {
    const element = compile('tr-switch-size="sm"');

    expect(element.hasClass('tr-switch-sm')).toBe(true);
  });

  it('adds the right-side switch class when requested', function () {
    const element = compile('tr-switch-side="right"');

    expect(element.hasClass('tr-switch-right')).toBe(true);
  });
});

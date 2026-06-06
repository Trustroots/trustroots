import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-focustip.client.directive';

describe('trFocustip directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(tip) {
    $rootScope.tipText = tip;
    const element = $compile('<input type="text" tr-focustip="tipText" />')(
      $rootScope,
    );
    $rootScope.$digest();

    return element;
  }

  it('renders help block and toggles visibility on focus', function () {
    const element = compile('Tip text');
    const scope = element.isolateScope();

    expect(scope.enabled).toBeUndefined();
    expect(element.next().hasClass('help-block')).toBe(true);

    element.triggerHandler({
      type: 'focus',
      preventDefault: jasmine.createSpy(),
    });
    expect(scope.enabled).toBe(true);

    element.triggerHandler({
      type: 'blur',
      preventDefault: jasmine.createSpy(),
    });
    expect(scope.enabled).toBe(false);
  });

  it('does not show helper block for non-string tip values', function () {
    const element = compile(10);
    const scope = element.isolateScope();

    element.triggerHandler({
      type: 'focus',
      preventDefault: jasmine.createSpy(),
    });
    expect(scope.enabled).toBe(false);
  });
});

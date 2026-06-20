import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-placeholder.client.directive';

describe('trPlaceholder directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  it('renders the expected placeholder skeleton text', function () {
    const scope = $rootScope.$new();
    const element = $compile('<div tr-placeholder></div>')(scope);

    scope.$digest();

    expect(element.text()).toContain('Lorem ipsum');
    expect(element.find('span').length).toBe(3);
    expect(element.attr('class')).toContain('tr-placeholder');
  });
});

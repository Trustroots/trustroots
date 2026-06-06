import AppConfig from '@/modules/core/client/app/config';
import { canUseWebP } from '@/modules/core/client/utils/dom';
import '@/modules/tribes/client/tribes.client.module';
import '@/modules/tribes/client/directives/tr-tribe-styles.client.directive';

jest.mock('@/modules/core/client/utils/dom', () => ({
  canUseWebP: jest.fn(),
}));

describe('trTribeStyles directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    canUseWebP.mockReturnValue(false);
  }));

  afterEach(function () {
    jest.clearAllMocks();
  });

  function compile(attributes) {
    const scope = $rootScope.$new();
    const element = $compile(`<div ${attributes}></div>`)(scope);
    scope.$digest();
    return element;
  }

  it('applies jpg background images and tribe colors', function () {
    const element = compile(
      `tr-tribe-styles='{"slug":"hitchhikers","image":true,"color":"00ffaa"}' tr-tribe-styles-dimensions="600x400"`,
    );

    expect(element.attr('style')).toContain(
      'background-image:url(/uploads-circle/hitchhikers/600x400.jpg);',
    );
    expect(element.attr('style')).toContain('background-color:#00ffaa;');
  });

  it('uses webp image backgrounds when supported', function () {
    canUseWebP.mockReturnValue(true);

    const element = compile(
      `tr-tribe-styles='{"slug":"nomads","image":true}' tr-tribe-styles-dimensions="1024x768"`,
    );

    expect(element.attr('style')).toBe(
      'background-image:url(/uploads-circle/nomads/1024x768.webp);',
    );
  });

  it('leaves style untouched when required attributes are empty', function () {
    const element = compile(
      `tr-tribe-styles='{"slug":"nomads","image":true}' tr-tribe-styles-dimensions=""`,
    );

    expect(element.attr('style')).toBeUndefined();
    expect(canUseWebP).not.toHaveBeenCalled();
  });
});

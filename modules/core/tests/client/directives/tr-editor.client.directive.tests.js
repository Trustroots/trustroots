import AppConfig from '@/modules/core/client/app/config';
import '@testing-library/jest-dom/extend-expect';
import '@/modules/core/client/directives/tr-editor.client.directive';

describe('trEditor directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(function () {
    angular.mock.module(AppConfig.appModuleName);
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(attrs = '', initialModel = '') {
    const scope = $rootScope.$new();
    scope.options = {};
    scope.content = initialModel;
    scope.handleCtrlEnter = jasmine.createSpy('handleCtrlEnter');

    const element = $compile(
      `<div tr-editor tr-editor-options="options" ng-model="content" tr-editor-on-ctrl-enter="handleCtrlEnter()" ${attrs}></div>`,
    )(scope);
    scope.$digest();

    const ngModel = element.controller('ngModel');

    return {
      element,
      scope,
      editor: ngModel.editor,
    };
  }

  it('adds the expected class and renders ngModel content', function () {
    const { element } = compile('', '<p>initial</p>');

    expect(element.hasClass('tr-editor')).toBe(true);
    expect(element.html()).toBe('<p>initial</p>');
  });

  it('keeps model sync into editor output', function () {
    const { element, scope } = compile();

    scope.$apply(() => {
      scope.content = '<p>saved</p>';
    });

    expect(element.html()).toBe('<p>saved</p>');
  });

  it('allows options updates without crashing the directive', function () {
    const { scope } = compile();

    scope.options = { toolbar: false };
    expect(() => {
      scope.$apply();
    }).not.toThrow();
  });

  it('registers a MediumEditor instance on the ngModel controller', function () {
    const { element } = compile();
    const ngModelCtrl = element.controller('ngModel');

    expect(ngModelCtrl.editor).toBeTruthy();
    expect(typeof ngModelCtrl.editor.subscribe).toBe('function');
  });
});

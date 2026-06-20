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

  function compile(attrs = '', initialModel = '', options = {}) {
    const includeCtrlEnter = options.includeCtrlEnter !== false;
    const scope = $rootScope.$new();
    scope.options = {};
    scope.content = initialModel;
    scope.handleCtrlEnter = jasmine.createSpy('handleCtrlEnter');

    const element = $compile(
      `<div tr-editor tr-editor-options="options" ng-model="content" ${
        includeCtrlEnter ? 'tr-editor-on-ctrl-enter="handleCtrlEnter()"' : ''
      } ${attrs}></div>`,
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

  it('updates the model when MediumEditor emits input', function () {
    const { editor, scope } = compile();
    const inputHandler = editor.events.customEvents.editableInput.slice(-1)[0];

    inputHandler(
      {},
      {
        innerHTML: ' <p>typed</p> ',
      },
    );

    expect(scope.content).toBe('<p>typed</p>');
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

  it('correctly identifies empty values for HTML and plain text', function () {
    const { element } = compile();
    const ngModel = element.controller('ngModel');

    expect(ngModel.$isEmpty('<span>   <br/> </span>')).toBe(true);
    expect(ngModel.$isEmpty('')).toBe(true);
    expect(ngModel.$isEmpty('   ')).toBe(true);
    expect(ngModel.$isEmpty('<p>hello</p>')).toBe(false);
    expect(ngModel.$isEmpty(' hello ')).toBe(false);
    expect(ngModel.$isEmpty('hello')).toBe(false);
    expect(ngModel.$isEmpty('   hello   ')).toBe(false);
    expect(ngModel.$isEmpty(null)).toBe(true);
    expect(ngModel.$isEmpty(undefined)).toBe(true);
  });

  it('updates placeholder extension during render if extension exists', function () {
    const { element } = compile();
    const ngModel = element.controller('ngModel');
    const placeholder = {
      updatePlaceholder: jasmine.createSpy('placeholder.updatePlaceholder'),
    };

    spyOn(
      element.controller('ngModel').editor,
      'getExtensionByName',
    ).and.returnValue(placeholder);
    ngModel.$render();

    expect(placeholder.updatePlaceholder).toHaveBeenCalledWith(element[0]);
  });

  it('renders without placeholder extension support', function () {
    const { element, scope } = compile();
    const ngModel = element.controller('ngModel');

    spyOn(ngModel.editor, 'getExtensionByName').and.returnValue(null);
    scope.$apply(() => {
      scope.content = '<p>without placeholder</p>';
    });

    expect(ngModel.editor.getExtensionByName).toHaveBeenCalledWith(
      'placeholder',
    );
    expect(element.html()).toBe('<p>without placeholder</p>');
  });

  it('does not subscribe to ctrl+enter when callback attribute is missing', function () {
    const { editor } = compile('', '', { includeCtrlEnter: false });

    expect(editor.events.customEvents.editableInput.slice(-1)[0]).toEqual(
      jasmine.any(Function),
    );
    expect(editor.events.customEvents.editableKeydownEnter).toHaveLength(1);
  });

  it('handles ctrl+enter input only when Ctrl key is pressed', function () {
    const { scope, editor } = compile();
    const preventDefault = jest.fn();
    const keydownHandler =
      editor.events.customEvents.editableKeydownEnter.slice(-1)[0];

    keydownHandler({ ctrlKey: true, preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(scope.handleCtrlEnter).toHaveBeenCalledTimes(1);

    keydownHandler({ ctrlKey: false, preventDefault });
    expect(scope.handleCtrlEnter).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});

import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-highlight-on-focus.client.directive';

describe('trSelectOnClick directive', function () {
  let $compile;
  let $rootScope;
  let $window;

  beforeEach(function () {
    $window = {
      getSelection() {
        return {
          toString() {
            return getSelectionText;
          },
        };
      },
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('$window', $window);
    });
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  let getSelectionText = '';

  beforeEach(function () {
    getSelectionText = '';
  });

  it('selects all text when click occurs without existing selection', function () {
    const scope = $rootScope.$new();
    const element = $compile(
      '<input type="text" value="hello" tr-select-on-click />',
    )(scope);

    const input = element[0];
    spyOn(input, 'setSelectionRange');
    scope.$digest();

    element.triggerHandler('click');

    expect(input.setSelectionRange).toHaveBeenCalledWith(0, input.value.length);
  });

  it('does not re-select when text is already highlighted', function () {
    getSelectionText = 'hello';
    const scope = $rootScope.$new();
    const element = $compile(
      '<input type="text" value="hello" tr-select-on-click />',
    )(scope);

    const input = element[0];
    spyOn(input, 'setSelectionRange');
    scope.$digest();

    element.triggerHandler('click');

    expect(input.setSelectionRange).not.toHaveBeenCalled();
  });
});

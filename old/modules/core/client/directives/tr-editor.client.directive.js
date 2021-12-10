import MediumEditor from 'medium-editor/dist/js/medium-editor';

/**
 * Directive to embed Medium Editor instances
 *
 * Medium editor: https://github.com/yabwe/medium-editor
 *
 * Fork of https://github.com/thijsw/angular-medium-editor
 * Original By Thijs Wijnmaalen (The MIT License)
 *
 *
 * Use as an attribute:
 * ```html
 * <p tr-editor></p>
 * ```
 *
 * Pass options with `tr-editor-options` attribute:
 * ```html
 * <p tr-editor tr-editor-options="options"></p>
 * ```
 *
 * See MediumEditor's options documentation for details:
 * @link https://github.com/yabwe/medium-editor#mediumeditor-options
 *
 * ## Examples
 *
 * #### Single line, no toolbar
 * Header example limited to one line and no toolbar
 * ```html
 * <h1 ng-model="title"
 *     tr-editor
 *     tr-editor-options="{disableReturn: true, disableExtraSpaces: true, toolbar: false}"
 *     data-placeholder="Enter a title"></h1>
 * ```
 *
 * #### Multiline with custom toolbar
 * Paragraph with support for multiple lines and customized toolbar buttons
 * ```html
 * <p ng-model="description"
 *    tr-editor
 *    tr-editor-options="{'toolbar': {'buttons': ['bold', 'italic', 'underline']}}"
 *    data-placeholder="Enter a description"></p>
 * ```
 *
 * #### Apply function on control+enter
 * ```html
 * <p tr-editor
 *    tr-editor-on-ctrl-enter="functionname()">
 * </p>
 * ```
 *
 */
angular.module('core').directive('trEditor', trEditorDirective);

/* @ngInject */
function trEditorDirective($parse) {
  function toInnerText(value) {
    // eslint-disable-next-line angular/document-service
    const tempEl = document.createElement('div');
    tempEl.innerHTML = value;
    const text = tempEl.textContent || '';
    return text.trim();
  }

  return {
    require: 'ngModel',
    restrict: 'AE',
    scope: {
      trEditorOptions: '=',
    },
    link(scope, iElement, iAttrs, ngModel) {
      const angularIElement = angular.element(iElement);

      angularIElement.addClass('tr-editor');

      ngModel.editor = new MediumEditor(iElement, scope.trEditorOptions);

      ngModel.$render = function () {
        iElement.html(ngModel.$viewValue || '');

        const placeholder = ngModel.editor.getExtensionByName('placeholder');
        if (placeholder) {
          placeholder.updatePlaceholder(iElement[0]);
        }
      };

      ngModel.$isEmpty = function (value) {
        if (/[<>]/.test(value)) {
          return toInnerText(value).length === 0;
        } else if (value) {
          return value.length === 0;
        } else {
          return true;
        }
      };

      ngModel.editor.subscribe('editableInput', function (event, editable) {
        ngModel.$setViewValue(editable.innerHTML.trim());
      });

      // On ctrl+enter
      if (iAttrs.trEditorOnCtrlEnter) {
        ngModel.editor.subscribe('editableKeydownEnter', function (event) {
          if (event.ctrlKey) {
            event.preventDefault();
            // Apply linked function
            $parse(iAttrs.trEditorOnCtrlEnter)(scope.$parent);
          }
        });
      }

      scope.$watch('trEditorOptions', function (trEditorOptions) {
        ngModel.editor.init(iElement, trEditorOptions);
      });
    },
  };
}

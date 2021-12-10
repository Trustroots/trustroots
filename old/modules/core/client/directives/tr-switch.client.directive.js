/**
 * Directive to create a pretty toggle switches out from `input[type=checkbox]`
 *
 * Use as an attribute of the surrounding label:
 * ```html
 * <label tr-switch>
 *   <input type="checkbox">
 * </label>
 * ```
 *
 */
angular.module('core').directive('trSwitch', trSwitchDirective);

/* @ngInject */
function trSwitchDirective() {
  return {
    restrict: 'A',
    link(scope, elem, attrs) {
      elem.addClass('tr-switch');

      // Small size
      // @todo: add other sizes (`xs`, `md`, `lg`) if needed
      // Default size is `md`
      if (attrs.trSwitchSize && attrs.trSwitchSize === 'sm') {
        elem.addClass('tr-switch-sm');
      }

      if (attrs.trSwitchSide && attrs.trSwitchSide === 'right') {
        elem.addClass('tr-switch-right');
      }

      // Add toggle
      const toggle = angular.element('<div class="toggle"></div>');
      elem.find('input').after(toggle);
    },
  };
}

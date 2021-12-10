/**
 * Directive that selects/highlights all text on input when clicking it.
 *
 * Usage:
 * <input tr-select-on-click type="text">
 *
 * Thanks to Martin:
 * @link http://stackoverflow.com/a/14996261/1984644
 */
angular.module('core').directive('trSelectOnClick', trSelectOnClickDirective);

/* @ngInject */
function trSelectOnClickDirective($window) {
  return {
    restrict: 'A',
    link(scope, element) {
      element.on('click', function () {
        if (!$window.getSelection().toString()) {
          // Required for mobile Safari
          this.setSelectionRange(0, this.value.length);
        }
      });
    },
  };
}

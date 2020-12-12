/**
 * Directive that simply Adds a helper text under the input and shows/hides it on focus/blur
 *
 * Usage:
 * <input tr-focustip="'Text to appear under input'" type="text">
 *
 * Note that currently this directive uses isolated scope, so you can't combine it with other isolate scope directives.
 */
angular.module('core').directive('trFocustip', trFocustipDirective);

/* @ngInject */
function trFocustipDirective($compile) {
  return {
    restrict: 'A',
    replace: false,
    scope: {
      trFocustip: '=',
    },
    link(scope, element) {
      // Compiled template
      // after() requires jQuery
      const template = $compile(
        '<div class="help-block" ng-show="enabled">' +
          scope.trFocustip +
          '</div>',
      )(scope);
      element.after(template);

      element
        .bind('focus', function () {
          // Enable only if there's some text to show
          scope.enabled =
            angular.isString(scope.trFocustip) && scope.trFocustip !== '';
          scope.$apply();
        })
        .bind('blur', function () {
          scope.enabled = false;
          scope.$apply();
        });
    },
  };
}

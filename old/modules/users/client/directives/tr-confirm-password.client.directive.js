/**
 * Directive to validate password matches to password in another field
 *
 * Usage:
 * <input type="password" name="password1" ng-model="password">
 *
 * <input type="password" name="password2" tr-confirm-password="password">
 *
 *
 */
angular
  .module('users')
  .directive('trConfirmPassword', trConfirmPasswordDirective);

/* @ngInject */
function trConfirmPasswordDirective() {
  return {
    restrict: 'A',
    require: 'ngModel',
    scope: {
      comparisonValue: '=trConfirmPassword',
    },
    link(scope, element, attributes, ngModel) {
      ngModel.$validators.confirmPassword = function (modelValue) {
        return modelValue === scope.comparisonValue;
      };

      scope.$watch('comparisonValue', function () {
        ngModel.$validate();
      });
    },
  };
}

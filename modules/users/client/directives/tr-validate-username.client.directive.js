/**
 * Directive to validate usernames (and check for availability)
 *
 * Usage:
 * ```
 * <input tr-validate-username>
 * ```
 *
 * Or to avoid validating specific string (like user's previous username):
 * ```
 * <input tr-validate-username="{{::username}}">
 * ```
 */
angular
  .module('users')
  .directive('trValidateUsername', trValidateUsernameDirective);

/* @ngInject */
function trValidateUsernameDirective($q, $timeout, SignupValidation) {
  let delayedUsernameValidation;

  return {
    restrict: 'A',
    require: 'ngModel',
    link(scope, elem, attr, ngModel) {
      const minlength = angular.isDefined(attr.minlength) ? attr.minlength : 1;

      ngModel.$asyncValidators.username = function (modelValue) {
        return $q(function (resolve, reject) {
          ngModel.$setValidity('username', true);

          if (modelValue && modelValue.length >= minlength) {
            if (delayedUsernameValidation) {
              $timeout.cancel(delayedUsernameValidation);
            }

            delayedUsernameValidation = $timeout(function () {
              delayedUsernameValidation = false;

              // If current value is the same as initial input value, don't do anything
              if (
                attr.trValidateUsername &&
                modelValue === attr.trValidateUsername
              ) {
                return resolve();
              }

              SignupValidation.post({ username: modelValue }).$promise.then(
                function (results) {
                  if (results && !results.valid) {
                    // Got result and it's negative
                    reject();
                  } else {
                    // Either result was positive or we couldn't receive any
                    // response, but regard networks errors as false negatives.
                    // Otherwise we'd flag everything invalid
                    resolve();
                  }
                },
              );
            }, 1000);
          }
        });
      };
    },
  };
}

(function () {
  'use strict';

  /**
   * Directive to validate usernames (and check for availability)
   */
  angular
    .module('users')
    .directive('trValidateUsername', trValidateUsernameDirective);

  /* @ngInject */
  function trValidateUsernameDirective($q, $timeout, SignupValidation) {

    var delayedUsernameValidation;

    return {
      restrict: 'A',
      require: 'ngModel',
      link: function(scope, elem, attr, ngModel) {

        var minlength = angular.isDefined(attr.minlength) ? attr.minlength : 1;

        // function(modelValue, viewValue) {
        ngModel.$asyncValidators.username = function(modelValue) {

          var deferred = $q.defer();

          ngModel.$setValidity('username', true);
          if (modelValue && modelValue.length >= minlength) {
            if (delayedUsernameValidation) {
              $timeout.cancel(delayedUsernameValidation);
            }

            delayedUsernameValidation = $timeout(function() {
              delayedUsernameValidation = false;
              SignupValidation
                .post({ username: modelValue })
                .$promise
                .then(function(results) {
                  if (results && !results.valid) {
                    // Got result and it's negative
                    deferred.reject();
                  } else {
                    // Either result was positive or we couldn't receive any
                    // response, but regard networks errors as false negatives.
                    // Otherwise we'd flag everything invalid
                    deferred.resolve();
                  }
                });
            }, 1000);
          }

          // return the promise of the asynchronous validator
          return deferred.promise;
        };

      }
    };
  }
}());

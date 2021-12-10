// Authentication service for user variables
angular.module('users').factory('Authentication', Authentication);

/* @ngInject */
function Authentication($window) {
  const auth = {
    user: $window.user || null,
  };
  return auth;
}

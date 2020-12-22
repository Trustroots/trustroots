angular.module('core').config(CoreConfig);

/* @ngInject */
function CoreConfig($httpProvider) {
  // Config HTTP Error Handling
  // Set the httpProvider "not authorized" interceptor
  $httpProvider.interceptors.push(CoreServiceUnavailable);
}

/* @ngInject */
function CoreServiceUnavailable($q, $rootScope) {
  return {
    responseError(rejection) {
      if (rejection.status === 503) {
        $rootScope.$broadcast('serviceUnavailable');
      }
      return $q.reject(rejection);
    },
  };
}

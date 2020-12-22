angular.module('users').config(UsersConfig);

/* @ngInject */
function UsersConfig($httpProvider) {
  // Config HTTP Error Handling
  // Set the httpProvider "not authorized" interceptor
  $httpProvider.interceptors.push([
    '$q',
    '$location',
    'Authentication',
    function ($q, $location, Authentication) {
      return {
        responseError(rejection) {
          if (rejection.config.url.startsWith('/api/')) {
            switch (rejection.status) {
              case 401:
                // Deauthenticate the global user
                Authentication.user = null;

                // Redirect to signin page
                $location.path('/signin');
                break;
              case 403:
                // Add unauthorized behaviour
                break;
            }
          }
          return $q.reject(rejection);
        },
      };
    },
  ]);
}

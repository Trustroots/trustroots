/*
(function () {
  'use strict';

  angular
    .module('admin')
    .config(AdminConfig);

  function AdminConfig($httpProvider) {

    // Config HTTP Error Handling
    // Set the httpProvider "not authorized" interceptor
    $httpProvider.interceptors.push(['$q', '$location', 'Authentication',
      function ($q, $location, Authentication) {
        return {
          responseError: function (rejection) {
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
          }
        };
      }
    ]);
  }

}());
*/

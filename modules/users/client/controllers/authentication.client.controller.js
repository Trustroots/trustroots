(function () {
  'use strict';

  angular
    .module('users')
    .controller('AuthenticationController', AuthenticationController);

  /* @ngInject */
  function AuthenticationController($scope, $rootScope, $http, $state, $stateParams, $analytics, Authentication, messageCenterService) {

    // If user is already signed in then redirect to search page
    if (Authentication.user) $state.go('search');

    // View Model
    var vm = this;

    // Exposed to the view
    vm.signin = signin;
    vm.continue = ($stateParams.continue);
    vm.isLoading = false;

    /**
     * Sign in
     */
    function signin() {
      vm.isLoading = true;

      $http.post('/api/auth/signin', vm.credentials)
      .then(
        function(response) { // On success function
          vm.isLoading = false;

          // If successful we assign the data to the global user model
          Authentication.user = response.data;
          $scope.$emit('userUpdated');

          // Attach user to $analytics calls from now on
          $analytics.setUsername(Authentication.user._id);

          $analytics.eventTrack('login.success', {
            category: 'authentication',
            label: 'Login success'
          });

          // Redirect to where we were left off before sign-in page
          // See modules/core/client/controllers/main.client.controller.js
          if (vm.continue) {
            var stateTo = $rootScope.signinState || 'search',
                stateToParams = $rootScope.signinStateParams || {};
            delete $rootScope.signinState;
            delete $rootScope.signinStateParams;
            $state.go(stateTo, stateToParams);
          } else {
            // Redirect to the search page
            $state.go('search');
          }
        },
        function(error) { // On error function
          vm.isLoading = false;
          messageCenterService.add('danger', error.data.message || 'Something went wrong.');
          $analytics.eventTrack('login.failed', {
            category: 'authentication',
            label: 'Login failed'
          });
        }
      );
    }

  }

}());

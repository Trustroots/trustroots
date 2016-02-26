(function() {
  'use strict';

  angular
    .module('users')
    .controller('ConfirmEmailController', ConfirmEmailController);

  /* @ngInject */
  function ConfirmEmailController($rootScope, $http, $state, $stateParams, Authentication) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.confirmEmail = confirmEmail;
    vm.success = null;
    vm.error = null;
    vm.isLoading = false;

    // Is ?signup at the url (set only for first email confirms)
    vm.signup = ($stateParams.signup) ? true : false;

    // Change user password
    function confirmEmail() {
      vm.isLoading = true;
      vm.success = vm.error = null;

      $http.post('/api/auth/confirm-email/' + $stateParams.token)
        .success(function(response) {

        // Attach user profile
        Authentication.user = response.user;
        $rootScope.$broadcast('userUpdated');

        // If successful and this was user's first confirm, welcome them to the community
        if(response.profileMadePublic) {
          $state.go('welcome');
        }
        // If succesfull and wasn't first time, say yay!
        else {
          vm.success = true;
        }

        })
        .error(function(response) {
          vm.error = true;
        });
    }

  }

})();

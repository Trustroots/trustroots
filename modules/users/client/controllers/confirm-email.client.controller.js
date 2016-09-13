(function () {
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
    vm.signup = angular.isDefined($stateParams.signup);

    // Change user password
    function confirmEmail() {
      vm.isLoading = true;
      vm.success = vm.error = null;

      $http.post('/api/auth/confirm-email/' + $stateParams.token)
      .then(
        function(response) { // On success function

          // Attach user profile
          Authentication.user = response.user;
          $rootScope.$broadcast('userUpdated');

          if (response.profileMadePublic) {
              // If successful and this was user's first confirm, welcome them to the community
            $state.go('welcome');
          } else {
            // If succesfull and wasn't first time, say yay!
            vm.success = true;
          }

        },
        function() { // On error function
          vm.error = true;
        }
      );
    }

  }

}());

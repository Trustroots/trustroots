(function() {
  'use strict';

  angular
    .module('users')
    .controller('ResetPasswordController', ResetPasswordController);

  /* @ngInject */
  function ResetPasswordController($rootScope, $stateParams, $http, $state, Authentication) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.error = null;
    vm.isLoading = false;
    vm.passwordDetails = null;
    vm.resetUserPassword = resetUserPassword;

    // Change user password
    function resetUserPassword() {
      vm.error = null;
      vm.isLoading = true;

      $http.post('/api/auth/reset/' + $stateParams.token, vm.passwordDetails)
        .success(function(response) {
          // Clear form
          vm.passwordDetails = null;

          // Attach user profile
          Authentication.user = response;

          // Notify app
          $rootScope.$broadcast('userUpdated');

          // And redirect to the success page
          $state.go('reset-success');
        })
        .error(function(response) {
          vm.error = response.message;
          vm.isLoading = false;
        });
    }
  }

})();

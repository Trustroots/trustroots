(function () {
  'use strict';

  angular
    .module('users')
    .controller('ForgotPasswordController', ForgotPasswordController);

  /* @ngInject */
  function ForgotPasswordController($http) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.success = null;
    vm.error = null;
    vm.isLoading = false;
    vm.credentials = null;
    vm.askForPasswordReset = askForPasswordReset;

    // Submit forgotten password account id
    function askForPasswordReset() {
      vm.success = vm.error = null;
      vm.isLoading = true;
      $http.post('/api/auth/forgot', vm.credentials)
        .success(function(response) {
          // Show user success message and clear form
          vm.credentials = null;
          vm.success = response.message;
          vm.isLoading = false;
        })
        .error(function(response) {
          // Show user error message
          vm.isLoading = false;
          vm.error = response.message;
        });
    }
  }

}());

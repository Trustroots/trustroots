angular
  .module('users')
  .controller('ResetPasswordController', ResetPasswordController);

/* @ngInject */
function ResetPasswordController(
  $rootScope,
  $stateParams,
  $http,
  $state,
  Authentication,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.error = null;
  vm.isLoading = false;
  vm.passwordDetails = null;
  vm.resetUserPassword = resetUserPassword;

  // Change user password
  function resetUserPassword() {
    vm.error = null;
    vm.isLoading = true;

    $http
      .post('/api/auth/reset/' + $stateParams.token, vm.passwordDetails)
      .then(
        function (response) {
          // On success function
          // Clear form
          vm.passwordDetails = null;

          // Attach user profile
          Authentication.user = response.data;

          // Notify app
          $rootScope.$broadcast('userUpdated');

          // And redirect to the success page
          $state.go('reset-success');
        },
        function (response) {
          // On error function
          vm.error = response.data.message;
          vm.isLoading = false;
        },
      );
  }
}

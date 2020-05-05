angular
  .module('users')
  .controller('RemoveProfileController', RemoveProfileController);

/* @ngInject */
function RemoveProfileController(
  $stateParams,
  Users,
  Authentication,
  messageCenterService,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.removeProfile = removeProfile;
  vm.resendConfirmation = resendConfirmation;
  vm.resendConfirmationLoading = false;
  vm.state = 'loading';

  removeProfile();

  // Remove user profile
  function removeProfile() {
    vm.state = 'loading';

    Users.deleteWithToken($stateParams.token)
      .then(function () {
        vm.state = 'success';
      })
      .catch(function () {
        vm.state = 'failure';
      });
  }

  // Get a new confirmation email
  function resendConfirmation() {
    vm.resendConfirmationLoading = true;
    new Users(Authentication.user)
      .$delete()
      .then(function (response) {
        vm.removeProfileInitialized = response.message || 'Success.';
      })
      .catch(function (response) {
        vm.removeProfileLoading = false;
        messageCenterService.add(
          'danger',
          response.message ||
            'Something went wrong while initializing profile removal, try again.',
          { timeout: 10000 },
        );
      });
  }
}

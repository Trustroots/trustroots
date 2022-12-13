angular
  .module('users')
  .controller('ProfileEditLocationsController', ProfileEditLocationsController);

/* @ngInject */
function ProfileEditLocationsController(
  $scope,
  Users,
  Authentication,
  messageCenterService,
) {
  // ViewModel
  const vm = this;

  vm.addSuccessMessage = () => {
    messageCenterService.add('success', 'Profile updated.');
  };

  vm.addErrorMessage = message => {
    messageCenterService.add(
      'danger',
      message || 'Something went wrong. Please try again!',
      { timeout: 10000 },
    );
  };

  vm.messageCenterService = messageCenterService;

  // Copy user to make a temporary buffer for changes.
  // Prevents changes remaining here when cancelling profile editing.
  vm.user = new Users(Authentication.user);

  // Exposed
  vm.updateUserProfile = updateUserProfile;

  /**
   * Update a user profile
   */
  function updateUserProfile(isValid) {
    if (isValid) {
      vm.user.$update(
        function (response) {
          Authentication.user = response;
          $scope.$emit('userUpdated');
          vm.addSuccessMessage();
        },
        function (response) {
          vm.addErrorMessage(response.data.message);
        },
      );
    } else {
      messageCenterService.add(
        'danger',
        'Please fix errors from your profile and try again.',
        { timeout: 10000 },
      );
    }
  }
}

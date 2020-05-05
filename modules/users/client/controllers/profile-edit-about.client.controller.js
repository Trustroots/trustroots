angular
  .module('users')
  .controller('ProfileEditAboutController', ProfileEditAboutController);

/* @ngInject */
function ProfileEditAboutController(
  $scope,
  $state,
  Users,
  Authentication,
  messageCenterService,
) {
  // ViewModel
  const vm = this;

  // Copy user to make a temporary buffer for changes.
  // Prevents changes remaining here when cancelling profile editing.
  vm.user = new Users(Authentication.user);

  // Exposed to view
  vm.updateUserProfile = updateUserProfile;

  // Get profile URL, i.e. `www.trustroots.org/profile/username`
  // - Remove `http(s)://`
  // - Highlight username part
  vm.profileURL = $state
    .href('profile', { username: vm.user.username }, { absolute: true })
    .replace(/^(https?):\/\//, '')
    .replace(vm.user.username, '<strong>' + vm.user.username + '</strong>');

  /**
   * Update a user profile
   */
  function updateUserProfile(isValid) {
    if (isValid) {
      vm.user.$update(
        function (response) {
          Authentication.user = response;
          $scope.$emit('userUpdated');
          messageCenterService.add('success', 'Profile updated.');
        },
        function (response) {
          messageCenterService.add(
            'danger',
            response.data.message || 'Something went wrong. Please try again!',
            { timeout: 10000 },
          );
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

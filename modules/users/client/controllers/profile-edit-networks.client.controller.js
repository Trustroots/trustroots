angular
  .module('users')
  .controller('ProfileEditNetworksController', ProfileEditNetworksController);

/* @ngInject */
function ProfileEditNetworksController(
  $scope,
  $http,
  Users,
  Authentication,
  messageCenterService,
) {
  // ViewModel
  const vm = this;

  // Copy user to make a temporary buffer for changes.
  // Prevents changes remaining here when cancelling profile editing.
  vm.user = new Users(Authentication.user);

  // Exposed
  vm.updateUserProfile = updateUserProfile;
  vm.removingSocialAccount = false;
  vm.removeUserSocialAccount = removeUserSocialAccount;
  vm.isConnectedSocialAccount = isConnectedSocialAccount;
  vm.hasConnectedAdditionalSocialAccounts =
    hasConnectedAdditionalSocialAccounts;
  vm.isWarmshowersId = isWarmshowersId;

  /**
   * Determine if given user handle for Warmshowers is an id or username
   * @link https://github.com/Trustroots/trustroots/issues/308
   */
  function isWarmshowersId() {
    let x;
    return isNaN(vm.user.extSitesWS)
      ? !1
      : ((x = parseFloat(vm.user.extSitesWS)), (0 | x) === x);
  }

  /**
   * Check if there are additional accounts
   */
  function hasConnectedAdditionalSocialAccounts() {
    return (
      vm.user.additionalProvidersData &&
      Object.keys(vm.user.additionalProvidersData).length
    );
  }

  /**
   * Check if provider is already in use with current user
   */
  function isConnectedSocialAccount(provider) {
    return (
      vm.user.additionalProvidersData &&
      vm.user.additionalProvidersData[provider]
    );
  }

  /**
   * Remove a user social account
   */
  function removeUserSocialAccount(provider) {
    $http.delete('/api/users/accounts/' + provider).then(
      function (response) {
        // On success function
        messageCenterService.add(
          'success',
          'Succesfully disconnected from ' + provider,
        );
        vm.user = Authentication.user = response.data;
        $scope.$emit('userUpdated');
      },
      function (response) {
        // On error function
        messageCenterService.add(
          'danger',
          response.data.message ||
            'Something went wrong. Try again or contact us to disconnect your profile.',
          { timeout: 10000 },
        );
      },
    );
  }

  /**
   * Update a user profile
   */
  function updateUserProfile(isValid) {
    if (isValid) {
      vm.user.$update(
        function (response) {
          Authentication.user = response;
          $scope.$emit('userUpdated');
          messageCenterService.add('success', 'Hospitality networks updated.');
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

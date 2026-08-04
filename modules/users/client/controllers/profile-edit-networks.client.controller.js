// Import the explicit CJS path: webpack 4 doesn't support the package's
// `exports` map, so `nostr-tools/nip19` can't be resolved here.
const { npubEncode } = require('nostr-tools/lib/cjs/nip19.js');

angular
  .module('users')
  .controller('ProfileEditNetworksController', ProfileEditNetworksController);

/* @ngInject */
function ProfileEditNetworksController(
  $scope,
  $http,
  $q,
  $window,
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
  vm.removeUserSocialAccount = removeUserSocialAccount;
  vm.isConnectedSocialAccount = isConnectedSocialAccount;
  vm.legacySocialProviders = ['facebook', 'github', 'twitter'];
  vm.hasLegacySocialAccounts = hasLegacySocialAccounts;
  vm.isWarmshowersId = isWarmshowersId;
  vm.nostrNip07Loading = false;
  vm.nostrNip07SuggestedNpub = '';
  vm.applyNostrNip07Suggestion = applyNostrNip07Suggestion;
  vm.hasNostrNip07Suggestion = hasNostrNip07Suggestion;
  vm.nostrNip07SuggestionButtonText = nostrNip07SuggestionButtonText;

  detectNostrNip07();

  /**
   * Try to get user's nostr npub from a NIP-07 browser extension.
   */
  function detectNostrNip07() {
    if (!$window.nostr || !angular.isFunction($window.nostr.getPublicKey)) {
      return;
    }

    vm.nostrNip07Loading = true;

    $q.when()
      .then(function () {
        return $window.nostr.getPublicKey();
      })
      .then(function (publicKey) {
        vm.nostrNip07SuggestedNpub = npubEncode(publicKey);
      })
      .catch(angular.noop)
      .finally(function () {
        vm.nostrNip07Loading = false;
      });
  }

  /**
   * Check if the detected NIP-07 npub is useful for the current form value.
   */
  function hasNostrNip07Suggestion() {
    return (
      Boolean(vm.nostrNip07SuggestedNpub) &&
      normalizeNpub(vm.user.nostrNpub) !==
        normalizeNpub(vm.nostrNip07SuggestedNpub)
    );
  }

  /**
   * Button text depends on whether we're setting or replacing the npub.
   */
  function nostrNip07SuggestionButtonText() {
    return vm.user.nostrNpub ? 'Replace with this npub' : 'Use this npub';
  }

  /**
   * Apply the suggested NIP-07 npub to the existing profile form.
   */
  function applyNostrNip07Suggestion() {
    if (!hasNostrNip07Suggestion()) {
      return;
    }

    vm.user.nostrNpub = vm.nostrNip07SuggestedNpub;

    if ($scope.profileEdit) {
      $scope.profileEdit.unsavedModifications = true;
    }
  }

  function normalizeNpub(npub) {
    return (npub || '').trim().toLowerCase();
  }

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
  function hasLegacySocialAccounts() {
    return vm.legacySocialProviders.some(isConnectedSocialAccount);
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
          'Successfully deleted the ' + provider + ' connection.',
        );
        vm.user = Authentication.user = response.data;
        $scope.$emit('userUpdated');
      },
      function (response) {
        // On error function
        messageCenterService.add(
          'danger',
          response.data.message ||
            'Something went wrong. Try again or contact us to delete this connection.',
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

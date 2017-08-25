(function () {
  'use strict';

  angular
    .module('users')
    .controller('ProfileEditAboutController', ProfileEditAboutController);

  /* @ngInject */
  function ProfileEditAboutController($scope, $state, Languages, Users, Authentication, messageCenterService) {

    // ViewModel
    var vm = this;

    // Copy user to make a temporary buffer for changes.
    // Prevents changes remaining here when cancelling profile editing.
    vm.user = new Users(Authentication.user);

    // Exposed
    vm.updateUserProfile = updateUserProfile;
    vm.languages = Languages.get('array');
    vm.userLanguages = [];

    // Get profile URL, i.e. `www.trustroots.org/profile/username`
    // - Remove `http(s)://`
    // - Highlight username part
    vm.profileURL = $state
      .href('profile', { username: vm.user.username }, { absolute: true })
      .replace(/^(https?):\/\//, '')
      .replace(vm.user.username, '<strong>' + vm.user.username + '</strong>');

    // Format user language list for Chosen selector
    decodeUserLanguages();

    /*
     * Language selector
     * Selectors expects language list to be in format:
     *   [{ "key": "fre", "name": "French" }, { "key": "ger", "name": "German" }]
     * but user.languages contains just codes:
     *   ['fre', 'ger']
     *
     * decodeUserLanguages() formats array for Chosen selector
     * encodeUserLanguages() formats array back to user.languages format
     */
    function decodeUserLanguages() {
      var langs_arr = [];
      if (vm.user && vm.user.languages) {
        vm.user.languages.forEach(function (key) {
          langs_arr[langs_arr.length] = { key: key, name: vm.languages[key] };
        });
      }
      vm.userLanguages = langs_arr;
    }
    function encodeUserLanguages() {
      if (!vm.user) return;

      var langs_arr = [];
      vm.userLanguages.forEach(function (lang) {
        langs_arr[langs_arr.length] = lang.key;
      });
      vm.user.languages = langs_arr;
    }

    /**
     * Update a user profile
     */
    function updateUserProfile(isValid) {
      encodeUserLanguages();
      if (isValid) {
        vm.user.$update(function (response) {
          Authentication.user = response;
          $scope.$emit('userUpdated');
          messageCenterService.add('success', 'Profile updated.');
        }, function (response) {
          messageCenterService.add('danger', response.data.message || 'Something went wrong. Please try again!', { timeout: 10000 });
        });
      } else {
        messageCenterService.add('danger', 'Please fix errors from your profile and try again.', { timeout: 10000 });
      }
    }


  }

}());

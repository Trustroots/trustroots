(function() {
  'use strict';

  angular
    .module('users')
    .controller('EditProfileController', EditProfileController);

  /* @ngInject */
  function EditProfileController($scope, $modal, $http, $stateParams, $state, $window, Languages, Users, Authentication, messageCenterService, Upload, appSettings) {

    // ViewModel
    var vm = this;

    // Copy user to make a temporary buffer for changes.
    // Prevents changes remaining here when cancelling profile editing.
    vm.user = new Users(Authentication.user);

    // Exposed
    vm.birthdateOpen = birthdateOpen;
    vm.updateUserProfile = updateUserProfile;
    vm.avatarModal = avatarModal;
    vm.languages = Languages.get('array');
    vm.userLanguages = [];
    vm.removingSocialAccount = false;
    vm.removeUserSocialAccount = removeUserSocialAccount;
    vm.isConnectedSocialAccount = isConnectedSocialAccount;
    vm.hasConnectedAdditionalSocialAccounts = hasConnectedAdditionalSocialAccounts;

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
      vm.user.languages.forEach(function(key) {
        langs_arr[langs_arr.length] = {key: key, name: vm.languages[key]};
      });
      vm.userLanguages = langs_arr;
    }
    function encodeUserLanguages() {
      var langs_arr = [];
      vm.userLanguages.forEach(function(lang) {
        langs_arr[langs_arr.length] = lang.key;
      });
      vm.user.languages = langs_arr;
    }


    /**
     * Check if there are additional accounts
     */
    function hasConnectedAdditionalSocialAccounts(provider) {
      for (var i in vm.user.additionalProvidersData) {
        return true;
      }
      return false;
    }

    /**
     * Check if provider is already in use with current user
     */
    function isConnectedSocialAccount(provider) {
      return vm.user.provider === provider || (vm.user.additionalProvidersData && vm.user.additionalProvidersData[provider]);
    }

    /**
     * Remove a user social account
     */
    function removeUserSocialAccount(provider) {
      $http.delete('/api/users/accounts/' + provider)
        .success(function(response) {
          messageCenterService.add('success', 'Succesfully disconnected from ' + provider, { timeout: appSettings.flashTimeout });
          vm.user = Authentication.user = response;
          $scope.$emit('userUpdated');
        }).error(function(response) {
          messageCenterService.add('danger', response.message || 'Something went wrong. Try again or contact us to disconnect your profile.' , { timeout: 10000 });
        });
    }

    /*
     * Birthday input field
     * Use server 'appSettings.time' instead of client time
     * @link http://angular-ui.github.io/bootstrap/#/datepicker
     */
    vm.birthdateFormat = 'yyyy-MM-dd';
    vm.birthdateOpened = false;
    vm.birthdateOptions = {
      maxDate: moment(appSettings.time), //  Set an upper limit for mode.
      minDate: moment(appSettings.time).subtract(moment.duration(100, 'y')), // Set a lower limit for mode.
      formatYear: 'yyyy', // Format of year in year range
      startingDay: 1, // Starting day of the week from 0-6 (0=Sunday, ..., 6=Saturday)
      yearRange: 30, // Number of years displayed in year selection
      showWeeks: false, // Whether to display week numbers.
    };

    // A fix to stop birthdate input giving validation errors
    // This would come from the Mongo sometimes as "1984-10-09T22:00:00.000Z"
    // and we're just stripping it down to "1984-10-09"
    if(vm.user.birthdate) {
      vm.user.birthdate = vm.user.birthdate.substring(0, vm.birthdateFormat.length);
    }

    /**
     * Open birthdate dropdown
     */
    function birthdateOpen($event) {
      $event.preventDefault();
      $event.stopPropagation();
      vm.birthdateOpened = true;
    }

    /**
     * Update a user profile
     */
    function updateUserProfile(isValid) {
      encodeUserLanguages();
      if(isValid) {
        var user = new Users(vm.user);

        // Fixes #66 - <br> appearing to tagline with Firefox
        user.tagline = user.tagline.replace('<br>', '', 'g').replace('&nbsp;', ' ', 'g');
        user.$update(function(response) {
          Authentication.user = response;
          $scope.$emit('userUpdated');
          $state.go('profile', {username: response.username, updated: true});
        }, function(response) {
          messageCenterService.add('danger', response.data.message || 'Something went wrong. Please try again!' , { timeout: 10000 });
        });
      } else {
        vm.submitted = true;
      }
    }

    /**
     * Open avatar -modal
     * @todo: spearate into avatar-upload-service (move logic out of this controller)
     */
    function avatarModal(user, $event) {

      if($event) $event.preventDefault();

      var modalInstance = $modal.open({
        templateUrl: '/modules/users/views/profile/avatar-editor.client.modal.html',
        controller: 'AvatarEditorController',
        controllerAs: 'avatarEditor',
        animation: true,
        resolve: {
          user: function () {
            return vm.user;
          },
          appSettings: function () {
            return appSettings;
          }
        }
      });

      // On modal closing (cancel/save)
      modalInstance.result
        .then(function (user) {
          // Note that this won't end up to the DB as is, it's just used as a cache-buster for new avatar
          vm.user.updated = new Date();

          if(!vm.user.avatarUploaded) {
            vm.user.avatarUploaded = true;
          }
          user = new Users(vm.user);
          user.$update(function(response) {
            vm.user = Authentication.user = response;
            // Notify AppController
            $scope.$emit('userUpdated', response);
          }, function(response) {
            messageCenterService.add('danger', response.data.message || 'Oops! Something went wrong.', { timeout: appSettings.flashTimeout });
          });
        }, function() {
          //$log.log('modalInstance cancelled');
        });
    }

  }

})();

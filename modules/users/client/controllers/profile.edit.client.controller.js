(function() {
  'use strict';

  angular
    .module('users')
    .controller('EditProfileController', EditProfileController);

  /* @ngInject */
  function EditProfileController($scope, $uibModal, $http, $stateParams, $state, $window, $locale, $filter, Languages, Users, Authentication, messageCenterService, Upload, appSettings, uibDateParser) {

    // ViewModel
    var vm = this;

    // Copy user to make a temporary buffer for changes.
    // Prevents changes remaining here when cancelling profile editing.
    vm.user = new Users(Authentication.user);

    // Exposed
    vm.updateUserProfile = updateUserProfile;
    vm.avatarModal = avatarModal;
    vm.languages = Languages.get('array');
    vm.userLanguages = [];
    vm.removingSocialAccount = false;
    vm.removeUserSocialAccount = removeUserSocialAccount;
    vm.isConnectedSocialAccount = isConnectedSocialAccount;
    vm.hasConnectedAdditionalSocialAccounts = hasConnectedAdditionalSocialAccounts;
    vm.isWarmshowersId = isWarmshowersId;

    // Settings for first and last name inputs
    vm.editorInline = {
      disableReturn: true,
      disableExtraSpaces: true,
      toolbar: false
    };

    // Guide texts for external hospex site inputs
    vm.bwGuide = 'Go to your BeWelcome profile and copy the username from the address bar.' +
                 '<br><br><img class="img-responsive clearfix" src="/modules/users/img/guide-bw.png" alt="" width="319" height="32" aria-hidden="true">';

    vm.csGuide = 'Go to your "account and settings" page and copy your username.' +
                 '<br><br><img class="img-responsive clearfix" src="/modules/users/img/guide-cs.png" alt="" width="525" height="107" aria-hidden="true">';

    vm.wsGuide = 'Edit your Warmshowers profile and copy your numeric user id from the address bar.' +
                 '<br><br><img class="img-responsive clearfix" src="/modules/users/img/guide-ws.png" alt="" width="319" height="32" aria-hidden="true">';


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
     * Determine if given user handle for Warmshowers is an id or username
     * @link https://github.com/Trustroots/trustroots/issues/308
     */
    function isWarmshowersId() {
      var x;
      return isNaN(vm.user.extSitesWS) ? !1 : (x = parseFloat(vm.user.extSitesWS), (0 | x) === x);
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
      return vm.user.additionalProvidersData && vm.user.additionalProvidersData[provider];
    }

    /**
     * Remove a user social account
     */
    function removeUserSocialAccount(provider) {
      $http.delete('/api/users/accounts/' + provider)
        .success(function(response) {
          messageCenterService.add('success', 'Succesfully disconnected from ' + provider);
          vm.user = Authentication.user = response;
          $scope.$emit('userUpdated');
        }).error(function(response) {
          messageCenterService.add('danger', response.message || 'Something went wrong. Try again or contact us to disconnect your profile.' , { timeout: 10000 });
        });
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
      }
      else {
        messageCenterService.add('danger', 'Please fix errors from your profile and try again.' , { timeout: 10000 });
      }
    }

    /**
     * Open avatar -modal
     * @todo: spearate into avatar-upload-service (move logic out of this controller)
     */
    function avatarModal(user, $event) {

      if($event) $event.preventDefault();

      var modalInstance = $uibModal.open({
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
            messageCenterService.add('danger', response.data.message || 'Oops! Something went wrong.');
          });
        }, function() {
          //$log.log('modalInstance cancelled');
        });
    }

  }

})();

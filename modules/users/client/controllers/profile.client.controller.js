(function() {
  'use strict';

  angular
    .module('users')
    .controller('ProfileController', ProfileController);

  /* @ngInject */
  function ProfileController($scope, $stateParams, $state, $location, $uibModal, $filter, $window, Languages, Users, Contact, Authentication, $timeout, messageCenterService, profile, contact, appSettings) {

    // No user defined at URL, just redirect to user's own profile
    if(!$stateParams.username) {
      $state.go('profile.about', {username: Authentication.user.username});
    }

    // ViewModel
    var vm = this;
    vm.profile = profile;
    vm.contact = contact;

    // Exposed to the view
    vm.hasConnectedAdditionalSocialAccounts = hasConnectedAdditionalSocialAccounts;
    vm.isConnectedSocialAccount = isConnectedSocialAccount;
    vm.socialAccountLink = socialAccountLink;
    vm.toggleAvatarModal = toggleAvatarModal;
    vm.isWarmshowersId = isWarmshowersId;

    activate();

    /**
     * Initialize controller
     */
    function activate() {

      // When on small screen...
      if(angular.element('body').width() <= 480) {
        // By default we land to `about` tab of this controller
        // If we're on small screens, direct to `overview` tab instead
        if($state.current.name === 'profile.about') {
          // Timeout ensures `ui-sref-active=""` gets updated at the templates
          $timeout(function() {
            $state.go('profile.overview', { username: profile.username });
          });
        }
      }
      // When on bigger screen...
      // Redirect "mobile only" tabs to about tab
      else if(['profile.overview', 'profile.accommodation'].indexOf($state.current.name) > -1) {
        $state.go('profile.about', { username: profile.username });
      }

      // If this is authenticated user's own profile, measure profile description length
      if(Authentication.user._id === profile._id) {
        vm.profileDescriptionLength = Authentication.user.description ? $filter('plainTextLength')(Authentication.user.description) : 0;
      }

      /**
       * When contact removal modal signals that the contact was removed, remove it from this scope as well
       * @todo: any better way to keep vm.contact $resolved but wipe out the actual content?
       */
      $scope.$on('contactRemoved', function() {
        delete vm.contact._id;
      });
    }

    /**
     * Determine if given user handle for Warmshowers is an id or username
     * @link https://github.com/Trustroots/trustroots/issues/308
     */
    function isWarmshowersId() {
      var x;
      return isNaN(vm.profile.extSitesWS) ? !1 : (x = parseFloat(vm.profile.extSitesWS), (0 | x) === x);
    }

    /**
     * Open avatar modal (bigger photo)
     */
    function toggleAvatarModal() {
      $uibModal.open({
        template: '<a tr-avatar data-user="avatarModal.profile" data-size="512" data-link="false" ng-click="avatarModal.close()"></a>',
        controller: function($scope, $uibModalInstance, profile) {
          var vm = this;
          vm.profile = profile;
          vm.close = function() {
            $uibModalInstance.dismiss('cancel');
          };
        },
        controllerAs: 'avatarModal',
        animation: true,
        windowClass: 'modal-avatar',
        resolve: {
          profile: function() {
            return vm.profile;
          }
        }
      });
    }

    /**
     * Check if there are additional accounts
     */
    function hasConnectedAdditionalSocialAccounts(provider) {
      for (var i in vm.profile.additionalProvidersData) {
        return true;
      }
      return false;
    }

    /**
     * Check if provider is already in use with profile
     */
    function isConnectedSocialAccount(provider) {
      return vm.profile.provider === provider || (vm.profile.additionalProvidersData && vm.profile.additionalProvidersData[provider]);
    }

    /**
     * Return an URL for user's social media profiles
     * Ensure these values are published at users.profile.server.controller.js
     */
    function socialAccountLink(providerName, providerData) {
      if(providerName === 'facebook' && providerData.id) {
        return 'https://www.facebook.com/app_scoped_user_id/' + providerData.id;
      }
      else if(providerName === 'twitter' && providerData.screen_name) {
        return 'https://twitter.com/' + providerData.screen_name;
      }
      else if(providerName === 'github' && providerData.login) {
        return 'https://github.com/' + providerData.login;
      }
      else return '#';
    }

  }

})();

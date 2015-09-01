(function() {
  'use strict';

  angular
    .module('users')
    .controller('ProfileController', ProfileController);

  /* @ngInject */
  function ProfileController($scope, $stateParams, $state, $location, $modal, Languages, Users, Authentication, $timeout, messageCenterService, profile, appSettings) {

    // No user defined at URL, just redirect to user's own profile
    if(!$stateParams.username) {
      $state.go('profile', {username: Authentication.user.username});
    }

    // ViewModel
    var vm = this;
    vm.profile = profile;

    // Exposed to the view
    vm.hasConnectedAdditionalSocialAccounts = hasConnectedAdditionalSocialAccounts;
    vm.isConnectedSocialAccount = isConnectedSocialAccount;
    vm.socialAccountLink = socialAccountLink;
    vm.tabSelected = tabSelected;
    vm.toggleAvatarModal = toggleAvatarModal;
    vm.tabs = [
      {
        path: 'about',
        title: 'About',
        content: '/modules/users/views/profile/view-profile-about.client.view.html?c=' + appSettings.commit
      },
      {
        path: 'overview',
        title: 'Overview',
        content: '/modules/users/views/profile/view-profile-sidebar.client.view.html?c=' + appSettings.commit,
        onlySmallScreen: true
      },
      {
        path: 'accommodation',
        title: 'Accommodation',
        content: '/modules/offers/views/offers-view.client.view.html?c=' + appSettings.commit,
        onlySmallScreen: true
      },
      {
        path: 'contacts',
        title: 'Contacts',
        content: '/modules/contacts/views/contacts.client.view.html?c=' + appSettings.commit
      }
    ];

    // We landed here from profile editor, show success message
    if($stateParams.updated) {
      // $timeout due Angular overwriting message at $state change otherwise
      $timeout(function(){
        messageCenterService.add('success', 'Profile updated', { timeout: appSettings.flashTimeout });
      });
    }

    /**
     * Open avatar modal (bigger photo)
     */
    function toggleAvatarModal() {
      $modal.open({
        template: '<a tr-avatar data-user="avatarModal.profile" data-size="512" data-link="false" ng-click="avatarModal.close()"></a>',
        controller: function($scope, $modalInstance, profile) {
          var vm = this;
          vm.profile = profile;
          vm.close = function() {
            $modalInstance.dismiss('cancel');
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
     * Determine which tab to select
     */
    function tabSelected() {
      return ($stateParams.tab && ['overview', 'contacts'].indexOf($stateParams.tab) > -1) ? $stateParams.tab : 'overview';
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
     * Ensure these fields are set at users.profile.server.controller.js
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

'use strict';

angular.module('users').controller('ProfileController', ['$scope', '$stateParams', '$state', '$location', '$log', '$modal', 'Languages', 'Users', 'UserProfiles', 'Authentication', '$timeout', 'messageCenterService', 'SettingsFactory',
  function($scope, $stateParams, $state, $location, $log, $modal, Languages, Users, UserProfiles, Authentication, $timeout, messageCenterService, SettingsFactory) {

    var appSettings = SettingsFactory.get();

    $scope.user = Authentication.user; // Currently logged in user
    $scope.profile = false; // Profile to show
    $scope.languages = Languages.get('object');

    // We landed here from profile editor, show success message
    if($stateParams.updated) {
      // Timeout is here due Angular overwriting message at $state change otherwise
      $timeout(function(){
        messageCenterService.add('success', 'Profile updated', { timeout: appSettings.flashTimeout });
      });
    }

    // Fetch profile to show (note: not the currently logged in user's profile)
    $scope.findProfile = function() {
      if(!$stateParams.username) {
        // No username set, direct to your own profile
        $state.go('profile', {username: $scope.user.username});
      }
      else {
        // Get profile with $stateParams.username
        $scope.profile = UserProfiles.get({
          username: $stateParams.username
        },
        function() {},//@todo
        function(errorResponse) {
          $scope.profileError = true;
          switch (errorResponse.status) {
            case 403:
              $scope.error = 'Profile not found.';
              break;
            default:
              $scope.error = 'Something went wrong. Try again.';
          }
        });
      }
    };

    // Check if there are additional accounts
    $scope.hasConnectedAdditionalSocialAccounts = function(provider) {
      for (var i in $scope.profile.additionalProvidersData) {
        return true;
      }
      return false;
    };

    // Check if provider is already in use with profile
    $scope.isConnectedSocialAccount = function(provider) {
      return $scope.profile.provider === provider || ($scope.profile.additionalProvidersData && $scope.profile.additionalProvidersData[provider]);
    };

    /*
     * Return an URL for user's social media profiles
     * Ensure these fields are set at users.profile.server.controller.js
     */
    $scope.socialAccountLink = function(provider, data) {
      if(provider === 'facebook' && data.id) {
        return 'https://www.facebook.com/app_scoped_user_id/' + data.id;
      }
      else if(provider === 'twitter' && data.screen_name) {
        return 'https://twitter.com/' + data.screen_name;
      }
      else if(provider === 'github' && data.login) {
        return 'https://github.com/' + data.login;
      }
      else return '#';
    };

    $scope.tabSelected = ($stateParams.tab && ['overview', 'contacts'].indexOf($stateParams.tab) > -1) ? $stateParams.tab : 'overview';

    $scope.tabs = [
      {
        path: 'about',
        title: 'About',
        content: '/modules/users/views/profile/view-profile-about.client.view.html?c=' + appSettings.commit,
        active: $stateParams.tab && $stateParams.tab === 'about'
      },
      {
        path: 'overview',
        title: 'Overview',
        content: '/modules/users/views/profile/view-profile-sidebar.client.view.html?c=' + appSettings.commit,
        active: $stateParams.tab && $stateParams.tab === 'overview',
        onlySmallScreen: true
      },
      {
        path: 'accommodation',
        title: 'Accommodation',
        content: '/modules/offers/views/view-offers.client.view.html?c=' + appSettings.commit,
        active: $stateParams.tab && $stateParams.tab === 'accommodation',
        onlySmallScreen: true
      },
      {
        path: 'contacts',
        title: 'Contacts',
        content: '/modules/contacts/views/contacts.client.view.html?c=' + appSettings.commit,
        active: $stateParams.tab && $stateParams.tab === 'contacts'
      }
    ];

    $scope.tabSelect = function(tabPath) {

      $scope.tabSelected = tabPath;

      //// @link http://angular-ui.github.io/ui-router/site/#/api/ui.router.state.$state

      //if(tabPath === 'overview') {
      //  $state.go('profile', {username: ($stateParams.username || $scope.user.username)});
      //}
      //else {
      //  $state.go('profile', {username: ($stateParams.username || $scope.user.username), tab: tabPath});
      //}

    };

  }
]);

'use strict';

angular.module('users').controller('ProfileController', ['$scope', '$stateParams', '$state', '$location', '$log', '$modal', 'Languages', 'Users', 'UserProfiles', 'Authentication',
  function($scope, $stateParams, $state, $location, $log, $modal, Languages, Users, UserProfiles, Authentication) {

    // If user is not signed in then redirect to login
    if (!Authentication.user) $state.go('signin');

    $scope.user = Authentication.user; // Currently logged in user
    $scope.profile = false; // Profile to show
    $scope.languages = Languages.get('object');

    // We landed here from profile editor, show success message
    // @todo: nice notifications https://github.com/Trustroots/trustroots/issues/24
    if($stateParams.updated) {
      $log.log('Profile updated');
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

    $scope.tabSelected = ($stateParams.tab && ['overview', 'references', 'contacts'].indexOf($stateParams.tab) > -1) ? $stateParams.tab : 'overview';

    $scope.tabs = [
      {
        path: 'overview',
        title: 'Overview',
        content: '/modules/users/views/profile/tab-profile-overview.client.view.html',
        active: $stateParams.tab && $stateParams.tab === 'overview'
      },
      /*{
        path: 'references',
        title: 'References',
        content: '/modules/references/views/list-references.client.view.html',
        active: $stateParams.tab && $stateParams.tab === 'references'
      },*/
      {
        path: 'contacts',
        title: 'Contacts',
        content: '/modules/contacts/views/contacts.client.view.html',
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

    /**
    * Open write/update reference -modal
    */
    $scope.referenceModal = function (profile, $event) {

      if($event) $event.preventDefault();

      var modalInstance = $modal.open({
        templateUrl: '/modules/references/views/create-reference.client.modal.html',
        controller: function ($scope, $modalInstance) {
          $scope.profile = profile;
          $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
          };
        }
      });
    };

  }
]);

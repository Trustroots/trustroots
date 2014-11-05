'use strict';

/* This declares to JSHint that 'moment' and 'settings' are global variables: */
/*global moment:false */
/*global settings:false */

angular.module('users').controller('EditProfileController', ['$scope', '$modal', '$http', '$log', '$stateParams', '$state', 'Languages', 'Users', 'Authentication',
  function($scope, $modal, $http, $log, $stateParams, $state, Languages, Users, Authentication) {

    // If user is not signed in then redirect to login
    if (!Authentication.user) $state.go('signin');

    $scope.user = Authentication.user;
    $scope.profile = false;
    $scope.languages = Languages.get('array');

    // Check if there are additional accounts
    $scope.hasConnectedAdditionalSocialAccounts = function(provider) {
      for (var i in $scope.user.additionalProvidersData) {
        return true;
      }
      return false;
    };

    // Check if provider is already in use with current user
    $scope.isConnectedSocialAccount = function(provider) {
      return $scope.user.provider === provider || ($scope.user.additionalProvidersData && $scope.user.additionalProvidersData[provider]);
    };

    // Remove a user social account
    $scope.removeUserSocialAccount = function(provider) {
      $scope.success = $scope.error = null;

      $http.delete('/users/accounts', {
        params: {
          provider: provider
        }
      }).success(function(response) {
        // If successful show success message and clear form
        $scope.success = true;
        $scope.user = Authentication.user = response;
      }).error(function(response) {
        $scope.error = response.message;
      });
    };

    /*
     * Birthday input field
     * Use server 'settings.time' instead of client time
     * @link http://angular-ui.github.io/bootstrap/#/datepicker
     */
    $scope.birthdateFormat = 'yyyy-MM-dd';
    $scope.birthdateOpened = false;
    $scope.birthdateOptions = {
      maxDate: moment(settings.time), //  Set an upper limit for mode.
      minDate: moment(settings.time).subtract(moment.duration(100, 'y')), // Set a lower limit for mode.
      formatYear: 'yyyy', // Format of year in year range
      startingDay: 1, // Starting day of the week from 0-6 (0=Sunday, ..., 6=Saturday)
      yearRange: 30, // Number of years displayed in year selection
      showWeeks: false, // Whether to display week numbers.
    };
    $scope.birthdateOpen = function($event) {
      $event.preventDefault();
      $event.stopPropagation();
      $scope.birthdateOpened = true;
    };

    // Update a user profile
    $scope.updateUserProfile = function(isValid) {
      if (isValid) {
        $scope.success = $scope.error = null;
        var user = new Users($scope.user);

        $log.log('->updateUserProfile');
        $log.log(user);

        user.$update(function(response) {
          $log.log('user.$update:');
          $log.log(response);

          $scope.success = true;
          Authentication.user = response;
          $state.go('profile-updated', {username: response.username, updated: true});
        }, function(response) {
          $scope.error = response.data.message;
        });
      } else {
        $scope.submitted = true;
      }
    };

    /**
    * Fetch profile
    */
    $scope.findProfile = function() {
      if(!$stateParams.username) {
        $scope.profile = $scope.user;
      }
      else {
        $scope.profile = Users.get({
          username: $stateParams.username
        });
      }
    };

    /**
    * Open avatar -modal
    */
    $scope.avatarModal = function (user, $event) {

      if($event) $event.preventDefault();

      var modalInstance = $modal.open({
        templateUrl: 'avatar.client.modal.html', //inline at template
        controller: function ($scope, $modalInstance) {
          $scope.user = user;
          $scope.close = function () {
            $modalInstance.dismiss('close');
          };
        }
      });

    };

  }
]);

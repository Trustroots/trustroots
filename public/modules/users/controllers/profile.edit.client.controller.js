'use strict';

angular.module('users').controller('EditProfileController', ['$scope', '$modal', '$http', '$stateParams', '$state', '$location', 'Languages', 'Users', 'Authentication',
  function($scope, $modal, $http, $stateParams, $state, $location, Languages, Users, Authentication) {
    $scope.user = Authentication.user;
    $scope.profile = false;

    // If user is not signed in then redirect back home
    if (!$scope.user) $location.path('/');

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

    // Update a user profile
    $scope.updateUserProfile = function(isValid) {
      if (isValid){
        $scope.success = $scope.error = null;
        var user = new Users($scope.user);

        user.$update(function(response) {
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

    $scope.languages = ['lt', 'en'];

  }
]);

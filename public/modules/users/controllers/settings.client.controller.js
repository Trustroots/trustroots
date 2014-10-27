'use strict';

angular.module('users').controller('SettingsController', ['$scope', '$http', '$state', 'Users', 'Authentication',
  function($scope, $http, $state, Users, Authentication) {

    // If user is not signed in then redirect to login
    if (!Authentication.user) $state.go('signin');

    $scope.user = Authentication.user;

    // Change user email
    $scope.updateUserEmail = function() {
      $scope.emailSuccess = $scope.emailError = null;
      var user = new Users($scope.user);

      user.$update(function(response) {
        $scope.emailSuccess = 'Email update. Check your inbox, you should have received an confirmation email which has a link you need to click. Email change will not be active until that.';
        Authentication.user = response;
      }, function(response) {
        $scope.emailError = response.data.message;
      });
    };

    // Change user email subscriptions
    $scope.updateUserSubscriptions = function() {
      $scope.subscriptionsSuccess = $scope.subscriptionsError = null;
      var user = new Users($scope.user);

      user.$update(function(response) {
        $scope.subscriptionsSuccess = 'Subscriptions updated.';
        Authentication.user = response;
      }, function(response) {
        $scope.subscriptionsError = response.data.message;
      });
    };

    // Change user password
    $scope.changeUserPassword = function() {
      $scope.passwordSuccess = $scope.passwordError = null;

      $http.post('/users/password', $scope.passwordDetails).success(function(response) {
        // If successful show success message and clear form
        $scope.passwordSuccess = true;
        $scope.passwordDetails = null;
      }).error(function(response) {
        $scope.passwordError = response.message;
      });
    };

    // Remove user permanently
    $scope.removalConfirm = false;
    $scope.removeUser = function() {
      $scope.success = $scope.error = null;

      if($scope.removalConfirm === true) {

        var duhhAreYouSureYouWantToRemoveYourself = confirm('Are you sure you want to remove your account? This cannot be undone.');

        if(duhhAreYouSureYouWantToRemoveYourself) {
          $http.post('/users/remove').success(function(response) {
              // Do something!
          }).error(function(response) {
            $scope.error = response.message;
          });
        }//yup, user is sure

      } // Require checkbox
      else {
        alert('Choose "I understand this cannot be undone"');
      }

    };

  }
]);

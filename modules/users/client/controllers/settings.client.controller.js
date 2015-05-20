'use strict';

angular.module('users').controller('SettingsController', ['$scope', '$http', '$state', 'Users', 'Authentication', 'messageCenterService', 'SettingsFactory',
  function($scope, $http, $state, Users, Authentication, messageCenterService, SettingsFactory) {

    var settings = SettingsFactory.get();

    $scope.user = Authentication.user;

    /**
     * Change user email
     */
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

    /**
     * Resend confirmation email for already sent email
     */
    $scope.resendUserEmailConfirm = function() {
      if($scope.user.emailTemporary) {
        $scope.user.email = $scope.user.emailTemporary;
        $scope.updateUserEmail();
      }
    };

    /**
     * Change user email subscriptions
     */
    $scope.updateUserSubscriptions = function() {
      var user = new Users($scope.user);
      user.$update(function(response) {
        messageCenterService.add('success', 'Subscriptions updated.', { timeout: settings.flashTimeout });
        Authentication.user = response;
      }, function(response) {
        messageCenterService.add('error', 'Error: ' + response.data.message, { timeout: settings.flashTimeout });
      });
    };

    /**
     * Change user password
     */
    $scope.changeUserPasswordLoading = false;
    $scope.currentPassword = '';
    $scope.newPassword = '';
    $scope.verifyPassword = '';
    $scope.changeUserPassword = function() {

      $scope.changeUserPasswordLoading = true;

      $http.post('/api/users/password', {
        currentPassword: $scope.currentPassword,
        newPassword: $scope.newPassword,
        verifyPassword: $scope.verifyPassword
      }).success(function(response) {
        $scope.currentPassword = '';
        $scope.newPassword = '';
        $scope.verifyPassword = '';
        $scope.changeUserPasswordLoading = false;

        $scope.user = Authentication.user = response.user;

        messageCenterService.add('success', response.message, { timeout: settings.flashTimeout });

      }).error(function(response) {
        $scope.changeUserPasswordLoading = false;
        messageCenterService.add('danger', ((response.message && response.message !== '') ? response.message : 'Password not changed due error, try again.'), { timeout: 10000 });
      });

    };

    /*
     * Remove user permanently
     */
    $scope.removalConfirm = false;
    $scope.removeUser = function() {
      $scope.success = $scope.error = null;

      if($scope.removalConfirm === true) {

        var duhhAreYouSureYouWantToRemoveYourself = confirm('Are you sure you want to remove your account? This cannot be undone.');

        if(duhhAreYouSureYouWantToRemoveYourself) {
          $http.post('/api/users/remove').success(function(response) {
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

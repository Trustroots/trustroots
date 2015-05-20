'use strict';

angular.module('users').controller('PasswordController', ['$scope', '$stateParams', '$http', '$location', 'Authentication',
  function($scope, $stateParams, $http, $location, Authentication) {
    $scope.authentication = Authentication;

    $scope.isLoading = false;

    // Submit forgotten password account id
    $scope.askForPasswordReset = function() {
      $scope.success = $scope.error = null;
      $scope.isLoading = true;
      $http.post('/api/auth/forgot', $scope.credentials).success(function(response) {
        // Show user success message and clear form
        $scope.credentials = null;
        $scope.success = response.message;
        $scope.isLoading = false;
      }).error(function(response) {
        // Show user error message and clear form
        $scope.credentials = null;
        $scope.isLoading = false;
        $scope.error = response.message;
      });
    };

    // Change user password
    $scope.resetUserPassword = function() {
      $scope.success = $scope.error = null;
      $scope.isLoading = true;

      $http.post('/api/auth/reset/' + $stateParams.token, $scope.passwordDetails).success(function(response) {
        // If successful show success message and clear form
        $scope.passwordDetails = null;

        // Attach user profile
        Authentication.user = response;

        // And redirect to the index page
        $location.path('/api/password/reset/success');
      }).error(function(response) {
        $scope.error = response.message;
        $scope.isLoading = false;
      });
    };
  }
]);

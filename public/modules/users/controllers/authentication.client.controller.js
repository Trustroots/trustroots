'use strict';

angular.module('users').controller('AuthenticationController', ['$scope', '$http', '$state', '$modal', 'Authentication',
  function($scope, $http, $state, $modal, Authentication) {

    // If user is already signed in then redirect to search page
    if (Authentication.user) $state.go('search');

    $scope.authentication = Authentication;

    $scope.isLoading = false;

    /**
     * Register
     */
    $scope.signup = function() {
      $scope.isLoading = true;
      $scope.error = false;
      $http.post('/auth/signup', $scope.credentials).success(function(response) {
        $scope.isLoading = false;
        // If successful we assign the response to the global user model
        $scope.authentication.user = response;
        $scope.success = 'Go to your ' + response.email + ' email account, find the email from Trustroots and click the confirm link. It might take up to 5-10 minutes for email to arrive and in rare occasions it might end up to spam folder — meanwhile you can fill in your profile!';
      }).error(function(response) {
        $scope.isLoading = false;
        $scope.error = response.message;
      });
    };

    // Make sure username is lowercase, as we require it to be at signup
    //$scope.credentials.username = $scope.credentials.username.toLowerCase();
    $scope.fixCredientals = function(credientals) {
      if(credientals.username) credientals.username = credientals.username.toLowerCase();
      return credientals;
    };

    /**
     * Login
     */
    $scope.signin = function() {
      $scope.error = false;
      $scope.isLoading = true;

      $http.post('/auth/signin', $scope.fixCredientals($scope.credentials)).success(function(response) {
        $scope.isLoading = false;

        // If successful we assign the response to the global user model
        $scope.authentication.user = response;

        // And redirect to the search page
        $state.go('search');
      }).error(function(response) {
        $scope.isLoading = false;
        $scope.error = response.message;
      });
    };

    /**
     * Open rules modal
     */
    $scope.openRules = function ($event) {

      if($event) $event.preventDefault();

      $modal.open({
        templateUrl: 'rules.client.modal.html', //inline at signup template
        controller: function ($scope, $modalInstance) {
          $scope.closeRules = function () {
            $modalInstance.dismiss('cancel');
          };
        }
      });
    };

  }
]);

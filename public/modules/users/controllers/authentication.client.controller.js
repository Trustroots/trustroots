'use strict';

/* This declares to JSHint that these are global variables: */
/*global flashTimeout:false */

angular.module('users').controller('AuthenticationController', ['$scope', '$rootScope', '$http', '$state', '$stateParams', '$modal', 'Authentication', 'messageCenterService',
  function($scope, $rootScope, $http, $state, $stateParams, $modal, Authentication, messageCenterService) {

    // If user is already signed in then redirect to search page
    if (Authentication.user) $state.go('search');

    $scope.authentication = Authentication;
    $scope.continue = ($stateParams.continue);
    $scope.isLoading = false;

    /**
     * Register
     */
    $scope.signup = function() {
      $scope.isLoading = true;
      $http.post('/auth/signup', $scope.credentials).success(function(response) {
        $scope.isLoading = false;
        // If successful we assign the response to the global user model
        $scope.authentication.user = response;
        $scope.success = 'Go to your ' + response.email + ' email account, find the email from Trustroots and click the confirm link. It might take up to 5-10 minutes for email to arrive and in rare occasions it might end up to spam folder — meanwhile you can fill in your profile!';
      }).error(function(response) {
        $scope.isLoading = false;
        messageCenterService.add('danger', response.message, { timeout: flashTimeout });
      });
    };

    // Make sure username is lowercase, as we require it to be at signup
    //$scope.credentials.username = $scope.credentials.username.toLowerCase();
    $scope.fixCredentials = function(credentials) {
      if(credentials.username) credentials.username = credentials.username.toLowerCase();
      return credentials;
    };

    /**
     * Login
     */
    $scope.signin = function() {
      $scope.isLoading = true;

      $http.post('/auth/signin', $scope.fixCredentials($scope.credentials)).success(function(response) {
        $scope.isLoading = false;

        // If successful we assign the response to the global user model
        $scope.authentication.user = response;

        // And redirect to the search page
        if($scope.continue) {
          $state.go($rootScope.signinState || 'search', $rootScope.signinStateParams || {});
        }
        else {
          $state.go('search');
        }
      }).error(function(response) {
        $scope.isLoading = false;
        messageCenterService.add('danger', response.message, { timeout: flashTimeout });
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

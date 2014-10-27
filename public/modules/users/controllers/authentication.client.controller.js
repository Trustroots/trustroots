'use strict';

angular.module('users').controller('AuthenticationController', ['$scope', '$http', '$state', '$modal', 'Authentication',
  function($scope, $http, $state, $modal, Authentication) {
    $scope.authentication = Authentication;

    // If user is signed in then redirect to search page
    if ($scope.authentication.user) $state.go('search');

    /**
     * Register
     */
    $scope.signup = function() {
      $http.post('/auth/signup', $scope.credentials).success(function(response) {
        // If successful we assign the response to the global user model
        $scope.authentication.user = response;

        // And redirect to the index page
        $state.go('welcome');
      }).error(function(response) {
        $scope.error = response.message;
      });
    };

    // Make sure username is lowercase, as we require it to be at signup
    //$scope.credentials.username = $scope.credentials.username.toLowerCase();
    $scope.fixCredientals = function(credientals) {
      credientals.username = credientals.username.toLowerCase();
      return credientals;
    };

    /**
     * Login
     */
    $scope.signin = function() {

      $http.post('/auth/signin', $scope.fixCredientals($scope.credentials)).success(function(response) {
        // If successful we assign the response to the global user model
        $scope.authentication.user = response;

        // And redirect to the search page
        $state.go('search');
      }).error(function(response) {
        $scope.error = response.message;
      });
    };

    /**
     * Open rules modal
     */
    $scope.openRules = function ($event) {

      if($event) $event.preventDefault();

      var modalInstance = $modal.open({
        templateUrl: 'rules.client.modal.html', //inline at template
        controller: function ($scope, $modalInstance) {
          $scope.closeRules = function () {
            $modalInstance.dismiss('cancel');
          };
        }
      });
    };

  }
]);

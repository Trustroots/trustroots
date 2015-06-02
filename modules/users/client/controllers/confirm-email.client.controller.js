'use strict';

angular.module('users').controller('ConfirmEmailController', ['$scope', '$http', '$state', '$stateParams', 'Authentication',
  function($scope, $http, $state, $stateParams, Authentication) {

    $scope.authentication = Authentication;

    // Is ?signup at the url (set only for first email confirms)
    $scope.signup = ($stateParams.signup) ? true : false;

    // Change user password
    $scope.confirmEmail = function() {
      $scope.isLoading = true;
      $scope.success = $scope.error = null;

      $http.post('/api/auth/confirm-email/' + $stateParams.token).success(function(response) {

        // Attach user profile
        Authentication.user = response.user;

        // If successful and this was user's first confirm, welcome them to the community
        if(response.profileMadePublic) {
          $state.go('welcome');
        }
        // If succesfull and wasn't first time, say yay!
        else {
          $scope.success = 'Your email is now confirmed!';
        }

      }).error(function(response) {
        $scope.error = response.message;
      });
    };
  }
]);

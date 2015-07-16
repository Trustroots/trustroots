'use strict';

angular.module('users').controller('AuthenticationController', ['$scope', '$rootScope', '$http', '$state', '$stateParams', '$modal', 'Authentication', 'messageCenterService', 'SettingsFactory',
  function($scope, $rootScope, $http, $state, $stateParams, $modal, Authentication, messageCenterService, SettingsFactory) {

    var settings = SettingsFactory.get();

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
      $http.post('/api/auth/signup', $scope.credentials).success(function(response) {
        $scope.isLoading = false;
        // If successful we assign the response to the global user model
        Authentication.user = response;
        $scope.authentication.user = response;
        $scope.success = 'We sent you and email to ' + response.email + ' with further instructions. ' +
                          'If you don\'t see this email in your inbox within 15 minutes, look for it in your junk mail folder. If you find it there, please mark it as "Not Junk".';
        $scope.$emit('userUpdated');
      }).error(function(response) {
        $scope.isLoading = false;
        messageCenterService.add('danger', response.message, { timeout: settings.flashTimeout });
      });
    };

    /**
     * Login
     */
    $scope.signin = function() {
      $scope.isLoading = true;

      $http.post('/api/auth/signin', $scope.credentials).success(function(response) {
        $scope.isLoading = false;

        // If successful we assign the response to the global user model
        Authentication.user = response;
        $scope.authentication.user = response;
        $scope.$emit('userUpdated');

        // Redirect to where we were left off before sign-in page
        // See modules/core/client/controllers/main.client.controller.js
        if($scope.continue) {
          var stateTo = $rootScope.signinState || 'search',
              stateToParams = $rootScope.signinStateParams || {};
          delete $rootScope.signinState;
          delete $rootScope.signinStateParams;
          $state.go(stateTo, stateToParams);

        }
        // Redirect to the search page
        else {
          $state.go('search');
        }
      }).error(function(response) {
        $scope.isLoading = false;
        messageCenterService.add('danger', response.message, { timeout: settings.flashTimeout });
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

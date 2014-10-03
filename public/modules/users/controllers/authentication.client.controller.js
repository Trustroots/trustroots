'use strict';

angular.module('users').controller('AuthenticationController', ['$scope', '$http', '$location', '$modal', 'Authentication',
	function($scope, $http, $location, $modal, Authentication) {
		$scope.authentication = Authentication;

		// If user is signed in then redirect back home
		if ($scope.authentication.user) $location.path('/');

		$scope.signup = function() {
			$http.post('/auth/signup', $scope.credentials).success(function(response) {
				// If successful we assign the response to the global user model
				$scope.authentication.user = response;

				// And redirect to the index page
				$location.path('welcome');
			}).error(function(response) {
				$scope.error = response.message;
			});
		};

		$scope.signin = function() {

			angular.element('#username')[0].focus();

		  // Make sure username is lowercase, as we require it to be at signup
		  $scope.credentials.username = $scope.credentials.username.toLowerCase();

			$http.post('/auth/signin', $scope.credentials).success(function(response) {
				// If successful we assign the response to the global user model
				$scope.authentication.user = response;

				// And redirect to the search page
				$location.path('search');
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

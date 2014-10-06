'use strict';

angular.module('users').controller('SettingsController', ['$scope', '$http', '$stateParams', '$state', '$location', 'Users', 'Authentication',
	function($scope, $http, $stateParams, $state, $location, Users, Authentication) {
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

		// Change user password
		$scope.changeUserPassword = function() {
			$scope.success = $scope.error = null;

			$http.post('/users/password', $scope.passwordDetails).success(function(response) {
				// If successful show success message and clear form
				$scope.success = true;
				$scope.passwordDetails = null;
			}).error(function(response) {
				$scope.error = response.message;
			});
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


		// Remove user permanently
		$scope.removeUser = function() {
			$scope.success = $scope.error = null;

			var duhhAreYouSureYouWantToRemoveYourself = confirm('Are you sure you want to remove your account? This cannot be undone.');

			if(duhhAreYouSureYouWantToRemoveYourself) {
			  $http.post('/users/remove').success(function(response) {
			  		// Do something!
			  }).error(function(response) {
			  	$scope.error = response.message;
			  });
		  }//yup, user is sure

		};

	}
]);

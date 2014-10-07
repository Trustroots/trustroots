'use strict';

angular.module('users').controller('SettingsController', ['$scope', '$http', '$location', 'Users',
	function($scope, $http, $location, Users) {

		// If user is not signed in then redirect back home
		if (!$scope.user) $location.path('/');


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

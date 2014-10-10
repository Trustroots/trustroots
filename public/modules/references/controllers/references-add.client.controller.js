'use strict';

// References controller
angular.module('references').controller('ReferencesAddController', ['$scope', '$log', '$state', '$stateParams', '$location', '$modal', 'Authentication', 'ReferencesBy', 'References',
	function($scope, $log, $state, $stateParams, $location, $modal, Authentication, ReferencesBy, References ) {
		$scope.authentication = Authentication;

		if(!$scope.userTo) {
			// Wait for profile from parent Controller (probably ProfileController)
			$scope.$parent.profile.$promise.then(function() {
				$scope.userTo = profile;
				$log.log('Reference to: ' + $scope.userTo);
			});
		}

		// Create new Reference
		$scope.create = function() {

			// Create new Reference object
			var reference = new References ({
				reference: this.reference,
				userTo: $scope.userTo.id
			});

			// Redirect after save
			reference.$save(function(response) {

				//if(modalInstance) {
				//	$log.log('Close modal');
				//	modalInstance.dismiss('cancel');
				//}

				$log.log('->Success');
				$log.log(response);

				$state.go('profile-reference', {'username': $scope.userTo.username, 'referenceId': response._id});

				// Clear form fields
				//$scope.reference = '';
			}, function(errorResponse) {
				$scope.error = errorResponse.data.message;
			});
		};

		// Remove existing Reference
		$scope.remove = function( reference, profile ) {
		  $log.log('->remove');
		  $log.log($stateParams);
		  $log.log(reference);

			if ( reference ) {

				reference.$remove();

				for (var i in $scope.references ) {
					if ($scope.references [i] === reference ) {
						$scope.references.splice(i, 1);
					}
				}
			} else {
				$scope.reference.$remove(function() {
					//$location.path('references');
					$state.go('profile-tab', {'username': profile.username, 'tab': 'references'});
				});
			}
		};

		// Update existing Reference
		$scope.update = function(profile) {
			var reference = $scope.reference;
			$log.log('->update');
			$log.log($stateParams);
			$log.log(reference);
			reference.$update(function() {
				//$location.path('references/' + reference._id);
				$state.go('profile-tab', {'username': profile.username, 'tab': 'references'});
			}, function(errorResponse) {
				$scope.error = errorResponse.data.message;
			});
		};

		// Find existing Reference
		$scope.findOne = function() {
			$scope.reference = References.get({
				referenceId: $stateParams.referenceId
			});
		};

	}
]);

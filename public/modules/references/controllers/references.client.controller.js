'use strict';

// References controller
angular.module('references').controller('ReferencesController', ['$scope', '$log', '$state', '$stateParams', '$location', '$modal', 'Authentication', 'ReferencesBy', 'References',
	function($scope, $log, $state, $stateParams, $location, $modal, Authentication, ReferencesBy, References ) {
		$scope.authentication = Authentication;

		// Create new Reference
		$scope.create = function() {

			$log.log('Reference to: ' + $scope.userTo);

			// Create new Reference object
			var reference = new References ({
				reference: this.reference,
				userTo: $scope.userTo
			});

			// Redirect after save
			reference.$save(function(response) {


				//if(modalInstance) {
				//	$log.log('Close modal');
				//	modalInstance.dismiss('cancel');
				//}

				$log.log('->Success');
				$log.log(response);

				$state.go('profile-reference', {'username': response.userTo.username, 'referenceId': response._id});

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

		// Find a list of References
		$scope.list = function(profile) {
			$log.log('list references: ' + profile.id);
			$scope.references = ReferencesBy.query({
				userId: profile.id || profile._id
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

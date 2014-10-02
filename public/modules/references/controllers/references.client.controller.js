'use strict';

// References controller
angular.module('references').controller('ReferencesController', ['$scope', '$stateParams', '$location', 'Authentication', 'References',
	function($scope, $stateParams, $location, Authentication, References ) {
		$scope.authentication = Authentication;

		// Create new Reference
		$scope.create = function() {
			// Create new Reference object
			var reference = new References ({
				name: this.name
			});

			// Redirect after save
			reference.$save(function(response) {
				$location.path('references/' + response._id);

				// Clear form fields
				$scope.name = '';
			}, function(errorResponse) {
				$scope.error = errorResponse.data.message;
			});
		};

		// Remove existing Reference
		$scope.remove = function( reference ) {
			if ( reference ) { reference.$remove();

				for (var i in $scope.references ) {
					if ($scope.references [i] === reference ) {
						$scope.references.splice(i, 1);
					}
				}
			} else {
				$scope.reference.$remove(function() {
					$location.path('references');
				});
			}
		};

		// Update existing Reference
		$scope.update = function() {
			var reference = $scope.reference ;

			reference.$update(function() {
				$location.path('references/' + reference._id);
			}, function(errorResponse) {
				$scope.error = errorResponse.data.message;
			});
		};

		// Find a list of References
		$scope.find = function() {
			$scope.references = References.query();
		};

		// Find existing Reference
		$scope.findOne = function() {
			$scope.reference = References.get({ 
				referenceId: $stateParams.referenceId
			});
		};
	}
]);
'use strict';

/* This declares to JSHint that 'settings' and 'jQuery' are global variables: */
/*global settings:false */
/*global jQuery:false */


angular.module('offers').controller('AddOfferController', ['$scope', '$http', '$state', '$stateParams', 'Offers', 'Authentication',
	function($scope, $http, $state, $stateParams, Offers, Authentication) {

		$scope.authentication = Authentication;

    $scope.isLoading = true;

		$scope.offer = false;

		// Leaflet
		angular.extend($scope, {
			center: {
				// Default to Europe
				lat: $scope.offer ? $scope.offer.location[0] : 48.6908333333,
				lng: $scope.offer ? $scope.offer.location[1] : 9.14055555556,
				zoom: $scope.offer ? 8 : 4
			},
			layers: {
				baselayers: {
					mapbox: {
						name: 'MapBox',
						type: 'xyz',
						url: 'http://{s}.tiles.mapbox.com/v3/{user}.{map}/{z}/{x}/{y}.png',
						layerParams: {
							user: settings.mapbox.user,
							map: settings.mapbox.map
						}
					}
				}
			},
			defaults: {
				scrollWheelZoom: false
			}
		});

		// Check if user already has previous offer
		$scope.findOffer = function() {

			$scope.isLoading = true;

			$scope.offer = Offers.get({
				userId: Authentication.user._id
			}, function(offer){
		  	$scope.isLoading = false;
				if(offer.location) {
				  $scope.center.lat = $scope.offer.location[0];
				  $scope.center.lng = $scope.offer.location[1];
				  $scope.center.zoom = 8;
			  }
				// Push some defaults to offer
				else {
					$scope.offer.maxGuests = 1;
					$scope.offer.status = 'yes';
				}

				// Determine new status from URL, overrides previous status
				if($stateParams.status && jQuery.inArray( $stateParams.status, ['yes', 'maybe', 'no'] ) ) {
					$scope.offer.status = $stateParams.status;
				}

			});

		};


		$scope.addOffer = function() {
      $scope.isLoading = true;

			var offer = new Offers({
			  status: this.offer.status,
				description: this.offer.description,
				noOfferDescription: this.offer.noOfferDescription,
				location: [ parseFloat($scope.center.lat), parseFloat($scope.center.lng) ],
				maxGuests: this.offer.maxGuests,
			});

			offer.$save(function(response) {
				// Done!
				$scope.isLoading = false;
				$state.go('profile');
			}, function(errorResponse) {
				$scope.isLoading = false;
				$scope.error = errorResponse.data.message;
			});

		};


		// Map address search
		$scope.searchQuery = '';
		$scope.searchQuerySearching = false;
		$scope.enterSearchAddress = function (event) {
			if (event.which === 13) $scope.searchAddress();
		};
		$scope.searchAddress = function () {
			if($scope.searchQuery !== '') {
				$scope.searchQuerySearching = true;
				$http
					.get('http://nominatim.openstreetmap.org/search?q=' + $scope.searchQuery.replace(/ /g, '+') + '&format=json&limit=1&email=' + settings.osm.email)
					.success(function (data) {
						$scope.searchQuerySearching = false;
						if (data[0] && parseFloat(data[0].importance) > 0.5) {

							var lon = parseFloat(data[0].lon);
							var lat = parseFloat(data[0].lat);

							$scope.bounds.southWest.lat = parseFloat(data[0].boundingbox[0]);
							$scope.bounds.northEast.lat = parseFloat(data[0].boundingbox[1]);
							$scope.bounds.southWest.lng = parseFloat(data[0].boundingbox[2]);
							$scope.bounds.northEast.lng = parseFloat(data[0].boundingbox[3]);
						}
					});
			}
		};

	}
]);

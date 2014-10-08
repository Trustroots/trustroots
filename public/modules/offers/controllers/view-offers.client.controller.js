'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */

angular.module('offers').controller('ViewOffersController', ['$scope', '$state', 'Offers',
	function($scope, $state, Offers) {

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
		$scope.findOffer = function(userId) {
			$scope.offer = Offers.get({
				userId: userId
			}, function(offer){
				if(offer.location) {
					$scope.center.lat = $scope.offer.location[0];
					$scope.center.lng = $scope.offer.location[1];
					$scope.center.zoom = 8;
				}
			});
		};

		$scope.hostingDropdown = false;

		$scope.hostingStatusLabel = function() {
      switch($scope.offer.status) {
        case 'yes':
          return 'I can host';
        case 'maybe':
          return 'I might be able to host';
        default:
          return 'I cannot host currently';
      }
		};

		$scope.hostingStatus = function(status) {
			$scope.offer.status = status;
			$scope.hostingDropdown = false;
			$state.go('offer-status', {'status': status});
		};


	}
]);

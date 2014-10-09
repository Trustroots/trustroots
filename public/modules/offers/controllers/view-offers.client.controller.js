'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */

angular.module('offers').controller('ViewOffersController', ['$scope', '$state', '$timeout', 'Offers',
	function($scope, $state, $timeout, Offers) {

		// Leaflet
		angular.extend($scope, {
			center: {
				// Default to Europe
				lat: $scope.offer ? $scope.offer.location[0] : 48.6908333333,
				lng: $scope.offer ? $scope.offer.location[1] : 9.14055555556,
				zoom: $scope.offer ? 12 : 4
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
			paths: {
				offer: {
					weight: 2,
					color: '#12b591',
					fillColor: '#12b591',
					fillOpacity: 0.5,
					latlngs: {
						lat: 48.6908333333,
						lng: 9.14055555556
					},
					radius: 500,
					type: 'circle'
				}
			},
			defaults: {
				scrollWheelZoom: false
			}
		});

		// Fetch that offer for us...
		if(!$scope.offer) {

			// Wait for profile from parent Controller (probably ProfileController)
			$scope.$parent.profile.$promise.then(function() {

			  Offers.get({
			    userId: $scope.$parent.profile.id
			  }, function(offer){

			  	// Make sure $scope.$apply() updates results
			  	// @link http://jimhoskins.com/2012/12/17/angularjs-and-apply.html
			  	$timeout(function() {
			      if(offer.location) {
			        $scope.center.lat = parseFloat(offer.location[0]);
			        $scope.center.lng = parseFloat(offer.location[1]);
			        $scope.center.zoom = 12;

							$scope.paths.offer.latlngs.lat = parseFloat(offer.location[0]);
							$scope.paths.offer.latlngs.lng = parseFloat(offer.location[1]);

			      }
            $scope.offer = offer;
          });

			  });

		  });

	  }


		$scope.hostingDropdown = false;

		$scope.hostingStatusLabel = function() {
			var status = ($scope.offer) ? $scope.offer.status : false;
        switch(status) {
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

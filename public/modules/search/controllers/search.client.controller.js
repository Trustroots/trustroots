'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */

angular.module('search').controller('SearchController', ['$scope', '$http',
	function($scope, $http) {

	  // @todo: how to change this setting?
		//L.Icon.Default.imagePath = '/modules/core/img/map';

    angular.extend($scope, {
      center: {
        lat: 24.0391667,
        lng: 121.525,
        zoom: 6
      },
      markers: {
        taipei: {
            layer: 'northTaiwan',
            lat: 25.0391667,
            lng: 121.525,
        },
        yangmei: {
            layer: 'northTaiwan',
            lat: 24.9166667,
            lng: 121.1333333
        },
        hsinchu: {
            layer: 'northTaiwan',
            lat: 24.8047222,
            lng: 120.9713889
        },
        miaoli: {
            layer: 'northTaiwan',
            lat: 24.5588889,
            lng: 120.8219444
        },
        tainan: {
            layer: 'southTaiwan',
            lat: 22.9933333,
            lng: 120.2036111
        },
        puzi: {
            layer: 'southTaiwan',
            lat: 23.4611,
            lng: 120.242
        },
        kaohsiung: {
            layer: 'southTaiwan',
            lat: 22.6252777778,
            lng: 120.3088888889
        },
        taitun: {
            layer: 'southTaiwan',
            lat: 22.75,
            lng: 121.15
        }
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
          },
          quest: {
            name: 'OpenMapQuest',
            type: 'xyz',
            url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
            layerOptions: {
              subdomains: ['1', '2', '3', '4'],
              attribution: 'contributors - &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              continuousWorld: true
            }
          },
          osm: {
            name: 'OpenStreetMap',
            type: 'xyz',
            url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            layerOptions: {
              subdomains: ['a', 'b', 'c'],
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              continuousWorld: true
            }
          }
        },
        overlays: {
          northTaiwan: {
            name: 'North cities',
            type: 'markercluster',
            visible: true
          },
          southTaiwan: {
            name: 'South cities',
            type: 'markercluster',
            visible: true
          }
        }
      }
    });

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

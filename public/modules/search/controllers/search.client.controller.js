'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */

angular.module('search').controller('SearchController', ['$scope', '$http', '$geolocation', 'Offers', 'leafletBoundsHelpers', 'Users', 'Authentication',
	function($scope, $http, $geolocation, Offers, leafletBoundsHelpers, Users, Authentication) {

	  // @todo: how to change this setting?
		//L.Icon.Default.imagePath = '/modules/core/img/map';

		// Start fetching user's location
		$scope.position = $geolocation.getCurrentPosition({
			timeout: 60000 // 1min
		});

		$scope.sidebarOpen = false;

		$scope.users = [];

		/**
		 * Center map to user's location
		 */
    angular.extend($scope, {
      center: {
				// Default to Europe
				lat: 48.6908333333,
				lng: 9.14055555556,
				zoom: 2
      },
      markers: {},
			bounds: leafletBoundsHelpers.createBoundsFromArray([
				[ 51.508742458803326, -0.087890625 ],
				[ 51.508742458803326, -0.087890625 ]
			]),
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
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>',
              continuousWorld: true
            }
          },
          osm: {
            name: 'OpenStreetMap',
            type: 'xyz',
            url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            layerOptions: {
              subdomains: ['a', 'b', 'c'],
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>',
              continuousWorld: true
            }
          },
          opencyclemap: {
						name: 'OpenCycleMap',
						type: 'xyz',
            url: 'http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png',
            options: {
              attribution: '&copy; <a href="http://www.opencyclemap.org">OpenCycleMap</a> &amp; <a href="http://www.openstreetmap.org">OSM</a>'
            }
          }
        },
        overlays: {
          hosts: {
            name: 'Hosts',
            type: 'markercluster',
            visible: true
          }
        }
      },
      events: {
        map: {
          enable: ['click'],
          logic: 'emit'
        }
      }
    });

		/**
		 * Center map to user's location
		 */
    $scope.position.then(function(position){
    	if(position.coords.latitude && position.coords.longitude) {
    		$scope.center.lat = position.coords.latitude;
    		$scope.center.lng = position.coords.longitude;
    		$scope.center.zoom = 7;
    	}
    });

		/**
		 * Catch map events:
		 * click, dblclick, mousedown, mouseup, mouseover, mouseout, mousemove, contextmenu, focus, blur,
		 * preclick, load, unload, viewreset, movestart, move, moveend, dragstart, drag, dragend, zoomstart,
		 * zoomend, zoomlevelschange, resize, autopanstart, layeradd, layerremove, baselayerchange, overlayadd,
		 * overlayremove, locationfound, locationerror, popupopen, popupclose
		 */
		$scope.$on('leafletDirectiveMap.click', function(event){
				$scope.sidebarOpen = false;
		});

    $scope.$on('leafletDirectiveMarker.click', function(e, args) {
				console.log('Open sidebar');
        $scope.sidebarOpen = true;
    });


	  /**
	   * Icons
	   */
	  $scope.icons = {
			hostingYes: {
        iconUrl: '/modules/core/img/map/marker-icon-yes.png',
        shadowUrl: '/modules/core/img/map/marker-shadow.png',
        iconSize:     [25, 35], // size of the icon
        shadowSize:   [33, 33], // size of the shadow
        iconAnchor:   [12, 35], // point of the icon which will correspond to marker's location
        shadowAnchor: [5, 34],  // the same for the shadow
        popupAnchor:  [-3, -17] // point from which the popup should open relative to the iconAnchor
      },
	  	hostingMaybe: {
	  		iconUrl: '/modules/core/img/map/marker-icon-maybe.png',
	  		shadowUrl: '/modules/core/img/map/marker-shadow.png',
	  		iconSize:     [25, 35], // size of the icon
	  		shadowSize:   [33, 33], // size of the shadow
	  		iconAnchor:   [12, 35], // point of the icon which will correspond to marker's location
	  		shadowAnchor: [5, 34],  // the same for the shadow
	  		popupAnchor:  [-3, -17] // point from which the popup should open relative to the iconAnchor
	  	}
	  };


		/**
		 * Load content to map bounding box
		 * @todo bounds change only when map dragging is finished, we could shoot a query already while dragging every n ms.
		 */
    $scope.$watch('bounds', function(newBounds, oldBounds) {

		    $scope.markersB = Offers.query({
		      northEastLng: newBounds.northEast.lng,
		      northEastLat: newBounds.northEast.lat,
		      southWestLng: newBounds.southWest.lng,
		      southWestLat: newBounds.southWest.lat
		    }, function(offers){

					var markers = [];
          angular.forEach(offers, function(marker) {
            this.push({
						  //id: marker._id,
							lat: marker.locationFuzzy[0],
							lng: marker.locationFuzzy[1],
							user: marker.user,
							icon: (marker.status === 'yes') ? $scope.icons.hostingYes : $scope.icons.hostingMaybe
						});
          }, markers);

					angular.extend($scope.markers, markers);


		    });
    });


		/**
		 * Map address search
		 */
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

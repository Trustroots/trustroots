'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */

angular.module('search').controller('SearchController', ['$scope', '$http', '$geolocation', '$location', '$state', '$stateParams', '$timeout', '$log', 'Offers', 'leafletBoundsHelpers', 'Authentication', 'Languages',
  function($scope, $http, $geolocation, $location, $state, $stateParams, $timeout, $log, Offers, leafletBoundsHelpers, Authentication, Languages) {

    $scope.user = Authentication.user; // Currently logged in user

    // If user is not signed in then redirect back home
    if (!$scope.user) $location.path('signin');

    // Default to Europe for now
    var defaultLocation = {
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 5
    };

    $scope.sidebarOpen = false;
    $scope.userReacted = false;
    $scope.languages = Languages.get('object');
    $scope.offer = false; // Offer to show
    $scope.notFound = false;
    $scope.currentSelection = {
      weight: 2,
      color: '#12b591',
      fillColor: '#12b591',
      fillOpacity: 0.5,
      latlngs: defaultLocation,
      radius: 500,
      type: 'circle',
      layer: 'selected'
    };

    /**
     * Center map to user's location
     */
    angular.extend($scope, {
      center: defaultLocation,
      markers: [],
      bounds: leafletBoundsHelpers.createBoundsFromArray([
        [ 51.508742458803326, -0.087890625 ],
        [ 51.508742458803326, -0.087890625 ]
      ]),
      layers: {
        baselayers: {
          mapbox: {
            name: 'Default',
            type: 'xyz',
            url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.access_token + ( settings.https ? '&secure=1' : ''),
            layerParams: {
              user: settings.mapbox.user,
              map: settings.mapbox.map[0]
            },
            layerOptions: {
              attribution: '<a href="http://www.openstreetmap.org/">OSM</a>',
              continuousWorld: true
            }
          },
          hitchmap: {
            name: 'Hitchmap',
            type: 'xyz',
            url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.access_token + ( settings.https ? '&secure=1' : ''),
            layerParams: {
              user: settings.mapbox.user,
              map: settings.mapbox.map[1]
            },
            layerOptions: {
              attribution: '<a href="http://www.openstreetmap.org/">OSM</a>',
              continuousWorld: true
            }
          },
          osm: {
            name: 'OpenStreetMap',
            type: 'xyz',
            url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            layerOptions: {
              subdomains: ['a', 'b', 'c'],
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>',
              continuousWorld: true
            }
          },
          // Doesn't support https
          quest: {
            name: 'OpenMapQuest',
            type: 'xyz',
            url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
            layerOptions: {
              subdomains: ['1', '2', '3', '4'],
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>',
              continuousWorld: true
            }
          }
        },
        overlays: {
          hosts: {
            name: 'Hosts',
            type: 'markercluster',
            visible: true,
            layerOptions: {
              // The maximum radius that a cluster will cover from the central marker (in pixels).
              // Default 80. Decreasing will make more smaller clusters. You could also use a function
              // that accepts the current map zoom and returns the maximum cluster radius in pixels.
              maxClusterRadius: 10
            }
          },
          selected: {
            name: 'Selected hosts',
            type: 'group',
            visible: false
          }
        }
      },
      paths: {
        selected: $scope.currentSelection
      },
      events: {
        map: {
          enable: ['click','mousedown'],
          logic: 'emit'
        }
      }
    });


    /**
     * Center map to user's location, received from Geolocation
     * Cancel setting this if user reacted to map in any way (searching, dragging etc)
     */
    $scope.position = $geolocation.getCurrentPosition({
      timeout: 60000 // 1min
    });
    $scope.position.then(function(position){
      if(position.coords.latitude && position.coords.longitude && !$scope.userReacted) {
        $scope.center.lat = position.coords.latitude;
        $scope.center.lng = position.coords.longitude;
        $scope.center.zoom = 5;
      }
    });


    /**
     * Catch map events:
     * click, dblclick, mousedown, mouseup, mouseover, mouseout, mousemove, contextmenu, focus, blur,
     * preclick, load, unload, viewreset, movestart, move, moveend, dragstart, drag, dragend, zoomstart,
     * zoomend, zoomlevelschange, resize, autopanstart, layeradd, layerremove, baselayerchange, overlayadd,
     * overlayremove, locationfound, locationerror, popupopen, popupclose
     */

    // Catch the first user interraction => stops moving to recognized browser's geolocation
    var mouseDownListener = $scope.$on('leafletDirectiveMap.mousedown', function() {
      $scope.userReacted = true;
      // Deregister this listener, @link http://stackoverflow.com/a/14898795
      mouseDownListener();
    });

    // Sidebar & markers react to these events
    $scope.$on('leafletDirectiveMap.click', function(event){
      $scope.sidebarOpen = false;
      $scope.offer = false;
      $scope.layers.overlays.selected.visible = false;
    });
    $scope.$on('leafletDirectiveMarker.click', function(e, args) {

      // Open offer card
      $scope.offer = Offers.get({
          offerId: args.leafletEvent.target.options.userId
      });

      // Show cirlce around the marker
      $scope.currentSelection.latlngs = args.leafletEvent.target._latlng;
      $scope.layers.overlays.selected.visible = true;

      $scope.userReacted = true;
      $scope.sidebarOpen = true;
    });


    /**
     * Open user's profile when clicking from search list
     */
    $scope.showUser = function(username) {
      $state.go('profile', {username: username});
    };


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
      }/*,
      hostingNo: {
        iconUrl: '/modules/core/img/map/marker-icon-no.png',
        shadowUrl: '/modules/core/img/map/marker-shadow.png',
        iconSize:     [25, 35], // size of the icon
        shadowSize:   [33, 33], // size of the shadow
        iconAnchor:   [12, 35], // point of the icon which will correspond to marker's location
        shadowAnchor: [5, 34],  // the same for the shadow
        popupAnchor:  [-3, -17] // point from which the popup should open relative to the iconAnchor
      }*/
    };

    /*
     * Load all map markers at init
     * @todo: move towards gradual bounding box loading in future
     */
    Offers.query({
      northEastLng: '',
      northEastLat: '',
      southWestLng: '',
      southWestLat: ''
    }, function(offers){
      //$log.log('->offers promise success:');
      //$log.log(offers);

      var markers = [];
      angular.forEach(offers, function(marker) {
        this.push({
          //id: marker._id,
          lat: marker.locationFuzzy[0],
          lng: marker.locationFuzzy[1],
          userId: marker._id,
          icon: (marker.status === 'yes') ? $scope.icons.hostingYes : $scope.icons.hostingMaybe,
          layer: 'hosts'
        });
      }, markers);

      angular.extend($scope.markers, markers);

    });
    /**
     * Load content to map bounding box
     * @todo bounds change only when map dragging is finished, we could shoot a query already while dragging every n ms.
     */
    /*
    $scope.$watch('bounds', function(newBounds, oldBounds) {
        $log.log('->bounds');
        Offers.query({
          northEastLng: newBounds.northEast.lng,
          northEastLat: newBounds.northEast.lat,
          southWestLng: newBounds.southWest.lng,
          southWestLat: newBounds.southWest.lat
        }, function(offers){
          $log.log('->offers promise success:');
          $log.log(offers);

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
    */



    /**
     * Map address search
     */
    $scope.searchQuery = '';
    $scope.searchQuerySearching = false;
    $scope.enterSearchAddress = function (event) {
      if (event.which === 13) {
        event.preventDefault();
        $scope.searchAddress();
      }
    };
    $scope.searchAddress = function () {
      if($scope.searchQuery !== '') {
        $scope.searchQuerySearching = true;

        $http
          .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + $scope.searchQuery + '.json?access_token=' + settings.mapbox.access_token)
          .then(function(response) {

            $scope.searchQuerySearching = false;

            if(response.status === 200 && response.data.features && response.data.features.length > 0) {
              $scope.mapLocate(response.data.features[0]);
            }
            else {
              // @Todo: nicer alert https://github.com/Trustroots/trustroots/issues/24
              $scope.notFound = true;
              $timeout(function(){
                $scope.notFound = false;
              }, 3000);
            }
          });

      }
    };


    /*
     * Show geo location at map
     * Used also when selecting search suggestions from the suggestions list
     */
    $scope.mapLocate = function(place) {

      // Show full place name at search  query
      $scope.searchQuery =  $scope.placeTitle(place);

      // Does the place have bounding box?
      if(place.bbox) {
        $scope.bounds = leafletBoundsHelpers.createBoundsFromArray([
          [ parseFloat(place.bbox[1]), parseFloat(place.bbox[0]) ],
          [ parseFloat(place.bbox[3]), parseFloat(place.bbox[2]) ]
        ]);
      }

      // Does it have lat/lng?
      else if(place.center) {
        $scope.center = {
          lat: parseFloat(place.center[0]),
          lng: parseFloat(place.center[1]),
          zoom: 5
        };
      }

      // @todo: then what?

    };


    /*
     * Search field's typeahead -suggestions
     *
     * @link https://www.mapbox.com/developers/api/geocoding/
     */
    $scope.searchSuggestions = function(val) {

      return $http
        .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + val + '.json?access_token=' + settings.mapbox.access_token)
        .then(function(response) {

          $scope.searchQuerySearching = false;

          if(response.status === 200 && response.data.features && response.data.features.length > 0) {

              return response.data.features.map(function(place){
                place.trTitle = $scope.placeTitle(place);
                return place;
              });

          }
          else return [];
        });

    };

    /*
     * Compile a nice title for the place, eg. "Jyväskylä, Finland"
     */
    $scope.placeTitle = function(place) {
      var title = '';

      if(place.place_name) title += place.place_name;
      else if(place.text) title += place.text;

      return title;
    };


    // Init search with URL
    if($stateParams.location && $stateParams.location !== '') {
      $scope.userReacted = true;
      $scope.searchQuery = $stateParams.location;
      $scope.searchAddress();
    }

  }
]);

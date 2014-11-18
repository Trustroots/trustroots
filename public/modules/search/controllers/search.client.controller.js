'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */

angular.module('search').controller('SearchController', ['$scope', '$http', '$geolocation', '$location', '$state', '$log', 'Offers', 'leafletBoundsHelpers', 'Authentication', 'Languages',
  function($scope, $http, $geolocation, $location, $state, $log, Offers, leafletBoundsHelpers, Authentication, Languages) {

    $scope.user = Authentication.user; // Currently logged in user

    // If user is not signed in then redirect back home
    if (!$scope.user) $location.path('signin');

    $scope.sidebarOpen = false;
    $scope.userReacted = false;
    $scope.languages = Languages.get('object');
    $scope.offer = false; // Offer to show


    /**
     * Center map to user's location
     */
    angular.extend($scope, {
      center: {
        // Default to Europe
        lat: 48.6908333333,
        lng: 9.14055555556,
        zoom: 5
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
            url: '//{s}.tiles.mapbox.com/v3/{user}.{map}/{z}/{x}/{y}.png' + ( settings.https ? '?secure=1' : ''),
            layerParams: {
              user: settings.mapbox.user,
              map: settings.mapbox.map
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
            visible: true
          }
        }
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
    });
    $scope.$on('leafletDirectiveMarker.click', function(e, args) {

      // Open offer card
      $scope.offer = Offers.get({
          offerId: args.leafletEvent.target.options.userId
      });

      $scope.userReacted = true;
      $scope.sidebarOpen = true;
      $log.log('Open sidebar');
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
      $log.log('->offers promise success:');
      $log.log(offers);

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

        $http.get('http://api.geonames.org/searchJSON?featureClass=A&featureClass=P', {
          params: {
            q: $scope.searchQuery,
            maxRows: 1,
            lang: 'en',
            style: 'full', // 'full' since we need bbox
            type: 'json',
            username: settings.geonames.username
          }
        }).then(function(response){

          $scope.searchQuerySearching = false;

          if(response.status === 200 && response.data.geonames) {
            if(response.data.geonames.length > 0) {

              $scope.mapLocate(response.data.geonames[0]);

            }
            else {
              // @Todo: nicer alert https://github.com/Trustroots/trustroots/issues/24
              alert('Whoop! We could not find such a place...');
            }
          }
        });

      }
    };


    /*
     * Show geonames location at map
     * Used also when selecting search suggestions from the suggestions list
     */
    $scope.mapLocate = function(place) {

      // Show full place name at search  query
      $scope.searchQuery =  $scope.placeTitle(place);

      // Does the place have bounding box?
      if(place.bbox) {
        $scope.bounds = leafletBoundsHelpers.createBoundsFromArray([
          [ parseFloat(place.bbox.south), parseFloat(place.bbox.east) ],
          [ parseFloat(place.bbox.north), parseFloat(place.bbox.west) ]
        ]);
      }

      // Does it have lat/lng?
      else if(place.lat && place.lng) {
        $scope.center = {
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lng),
          zoom: 5
        };
      }

      // @todo: then what?

    };


    /*
     * Search field's typeahead -suggestions
     *
     * featureClass is twice already at URL due limitations with $http.get()
     *
     * @link http://www.geonames.org/export/geonames-search.html
     */
    $scope.searchSuggestions = function(val) {

      return $http.get('http://api.geonames.org/searchJSON?featureClass=A&featureClass=P', {
        params: {
          q: val,
          maxRows: 10,
          lang: 'en',
          style: 'full', // 'full' since we need bbox
          type: 'json',
          username: settings.geonames.username
        }
      }).then(function(response){
        if(response.status === 200 && response.data.geonames.length > 0) {
          return response.data.geonames.map(function(place){
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

      // Prefer toponym name like 'Jyväskylä' instead of 'Jyvaskyla'
      if(place.toponymName) title += place.toponymName;
      else if(place.name) title += place.name;

      if(place.countryName) {
        if(title !== '') title += ', ';
        title += place.countryName;
      }

      return title;
    };

  }
]);

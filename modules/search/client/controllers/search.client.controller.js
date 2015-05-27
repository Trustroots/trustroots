'use strict';

angular.module('search').controller('SearchController', ['$scope', '$http', '$location', '$state', '$stateParams', '$timeout', '$log', 'Offers', 'leafletBoundsHelpers', 'Authentication', 'Languages', 'leafletData', 'SettingsFactory',
  function($scope, $http, $location, $state, $stateParams, $timeout, $log, Offers, leafletBoundsHelpers, Authentication, Languages, leafletData, SettingsFactory) {

    var settings = SettingsFactory.get();

    // Currently signed in user
    $scope.user = Authentication.user;

    // Default to Europe for now
    var defaultLocation = {
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 6
    };

    $scope.layerStyle = 'street';
    $scope.sidebarOpen = false;
    $scope.languages = Languages.get('object');
    $scope.offer = false; // Offer to show
    $scope.notFound = false;
    $scope.currentSelection = {
      weight: 2,
      color: '#989898',
      fillColor: '#b1b1b1',
      fillOpacity: 0.5,
      latlngs: defaultLocation,
      radius: 500, // Meters
      type: 'circle',
      layer: 'selectedOffers',
      clickable: false
    };
    $scope.minimumZoom = 3;

    // Return constructed icon
    // @link http://leafletjs.com/reference.html#icon
    var icon = function(status) {
      status = (status === 'yes') ? 'yes' : 'maybe';
      return L.icon({
        iconUrl:    '/modules/core/img/map/marker-icon-' + status + '.svg',
        iconSize:   [20, 20], // size of the icon
        iconAnchor: [10, 10] // point of the icon which will correspond to marker's location
      });
    };

    /**
     * The Variables passed to leaflet directive at init
     */
    $scope.defaults = {
        attributionControl: true,
        keyboard: true,
        worldCopyJump: true,
        controls: {
          layers: {
            visible: true,
            position: 'bottomleft',
            collapsed: true
          }
        }
    };
    $scope.center = {};
    $scope.bounds = {};
    $scope.layers = {
      baselayers: {},
      overlays: {
        selectedOffers: {
          name: 'Selected hosts',
          type: 'group',
          visible: false
        }
      }
    };
    $scope.paths = {
      selected: $scope.currentSelection
    };
    /**
     * Catch map events:
     * click, dblclick, mousedown, mouseup, mouseover, mouseout, mousemove, contextmenu, focus, blur,
     * preclick, load, unload, viewreset, movestart, move, moveend, dragstart, drag, dragend, zoomstart,
     * zoomend, zoomlevelschange, resize, autopanstart, layeradd, layerremove, baselayerchange, overlayadd,
     * overlayremove, locationfound, locationerror, popupopen, popupclose
     */
    $scope.events = {
      map: {
        enable: ['click','mousedown', 'moveend', 'load', 'baselayerchange'],
        logic: 'emit'
      }
    };
    $scope.lastbounds = {
      northEastLng: 0,
      northEastLat: 0,
      southWestLng: 0,
      southWestLat: 0
    };


    /**
     * Add additional layers if they're configured
     */
    if(settings.mapbox.map.default) {
      $timeout(function() {
        $scope.layers.baselayers.default = {
          name: 'Default',
          type: 'xyz',
          url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.publicKey + ( settings.https ? '&secure=1' : ''),
          layerParams: {
            user: settings.mapbox.user,
            map: settings.mapbox.map.default
          },
          layerOptions: {
            attribution: '<strong><a href="https://www.mapbox.com/map-feedback/#' + settings.mapbox.user + '.' + settings.mapbox.map.default + '/' + defaultLocation.lng + '/' + defaultLocation.lat + '/' + defaultLocation.zoom + '">Improve this map</a></strong>',
            continuousWorld: true,
            TRStyle: 'street'//Not native Leaflet key, required by our layer switch
          }
        };
      });
    }
    // Add Satellite
    if(settings.mapbox.map.satellite) {
      $timeout(function() {
        $scope.layers.baselayers.satellite = {
          name: 'Satellite',
          type: 'xyz',
          url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.publicKey + ( settings.https ? '&secure=1' : ''),
          layerParams: {
            user: settings.mapbox.user,
            map: settings.mapbox.map.satellite
          },
          layerOptions: {
            attribution: '<strong><a href="https://www.mapbox.com/map-feedback/#' + settings.mapbox.user + '.' + settings.mapbox.map.satellite + '/' + defaultLocation.lng + '/' + defaultLocation.lat + '/' + defaultLocation.zoom + '">Improve this map</a></strong>',
            continuousWorld: true,
            TRStyle: 'satellite' //Not native Leaflet key, required by our layer switch
          }
        };
      });
    }
    // Add experimental Hitchmap
    if(settings.mapbox.map.hitchmap) {
      $timeout(function() {
        $scope.layers.baselayers.hitchmap = {
          name: 'Hitchmap',
          type: 'xyz',
          url: '//{s}.tiles.mapbox.com/v4/{user}.{map}/{z}/{x}/{y}.png?access_token=' + settings.mapbox.publicKey + ( settings.https ? '&secure=1' : ''),
          layerParams: {
            user: settings.mapbox.user,
            map: settings.mapbox.map.hitchmap
          },
          layerOptions: {
            attribution: '<strong><a href="https://www.mapbox.com/map-feedback/#' + settings.mapbox.user + '.' + settings.mapbox.map.hitchmap + '/' + defaultLocation.lng + '/' + defaultLocation.lat + '/' + defaultLocation.zoom + '">Improve this map</a></strong>',
            continuousWorld: true,
            TRStyle: 'street'//Not native Leaflet, required by layer switch
          }
        };
      });
    }

    // Other secondary map layers

    // OpenStreetMap
    $scope.layers.baselayers.osm = {
      name: 'OpenStreetMap',
      type: 'xyz',
      url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      layerOptions: {
        subdomains: ['a', 'b', 'c'],
        attribution: '<strong><a href="https://www.openstreetmap.org/login#map=' + defaultLocation.zoom + '/' + defaultLocation.lat + '/' + defaultLocation.lng + '">Improve this map</a></strong>',
        continuousWorld: true,
        TRStyle: 'street'//Not native Leaflet key, required by our layer switch
      }
    };
    // OpenMapQuest (doesn't support https)
    $scope.layers.baselayers.quest = {
      name: 'OpenMapQuest',
      type: 'xyz',
      url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
      layerOptions: {
        subdomains: ['1', '2', '3', '4'],
        attribution:  '<strong><a href="https://www.openstreetmap.org/login#map=' + defaultLocation.zoom + '/' + defaultLocation.lat + '/' + defaultLocation.lng + '">Improve this map</a></strong>',
        continuousWorld: true,
        TRStyle: 'street'//Not native Leaflet, required by layer switch
      }
    };


    /*
     * Determine currently selected baselayer style
     * 'TRStyle' has to be set when defining layers.
     * Possible values are: street, satellite
     * Defaults to street
     */
    $scope.$on('leafletDirectiveMap.baselayerchange', function(event, layer) {
      $scope.layerStyle = (layer.leafletEvent.layer.options.TRStyle) ? $scope.layerStyle = layer.leafletEvent.layer.options.TRStyle : 'street';
    });

    //Setting up the cluster
    $scope.pruneCluster = new PruneClusterForLeaflet(60, 60);

    //Setting up the marker and click event
    $scope.pruneCluster.PrepareLeafletMarker = function(leafletMarker, data) {
      leafletMarker.on('click', function(e) {

        // Open offer card
        $scope.offer = Offers.get({
          offerId: data.userId
        });

        // Show cirlce around the marker
        $scope.currentSelection.latlngs = e.latlng;
        $scope.layers.overlays.selectedOffers.visible = true;

        $scope.sidebarOpen = true;

      });
      leafletMarker.setIcon(data.icon);
    };

    // Sidebar & markers react to these events
    $scope.$on('leafletDirectiveMap.click', function(event){
      $scope.sidebarOpen = false;
      $scope.offer = false;
      $scope.layers.overlays.selectedOffers.visible = false;
    });
    /*
    $scope.$on('leafletDirectiveMarker.click', function(e, args) {

    });
    */

    /**
     * Load markers to the current bounding box
     */
    $scope.getMarkers = function () {

      // Don't proceed if:
      // - Map does not have bounds set (typically at map init these might be missing for some milliseconds)
      // - If user isn't public(confirmed) yet - no need to hit API just to get 401
      if(!$scope.bounds.northEast || !$scope.user.public) return;

      //If we get out of the boundig box of the last api query we have to call the API for the new markers
      if($scope.bounds.northEast.lng > $scope.lastbounds.northEastLng || $scope.bounds.northEast.lat > $scope.lastbounds.northEastLat || $scope.bounds.southWest.lng < $scope.lastbounds.southWestLng || $scope.bounds.southWest.lat < $scope.lastbounds.southWestLat) {
        //We add a margin to the boundings depending on the zoom level
        var boundingDelta = 10/$scope.center.zoom;
        //Saving the current bounding box amd zoom
        $scope.lastbounds = {
          northEastLng: $scope.bounds.northEast.lng +boundingDelta,
          northEastLat: $scope.bounds.northEast.lat +boundingDelta,
          southWestLng: $scope.bounds.southWest.lng -boundingDelta,
          southWestLat: $scope.bounds.southWest.lat -boundingDelta
        };
        $scope.lastZoom = $scope.center.zoom;
        //API Call
        Offers.query({
          northEastLng: $scope.lastbounds.northEastLng,
          northEastLat: $scope.lastbounds.northEastLat,
          southWestLng: $scope.lastbounds.southWestLng,
          southWestLat: $scope.lastbounds.southWestLat
        }, function(offers){
          //Remove last markers
          $scope.pruneCluster.RemoveMarkers();
          // Let's go through those markers
          // This loop might look weird but it's actually speed optimized :P
          for (var i = -1, len = offers.length; ++i < len;) {
            var marker = new PruneCluster.Marker(
              offers[i].locationFuzzy[0],
              offers[i].locationFuzzy[1]
            );
            marker.data.icon = icon(offers[i].status);
            marker.data.userId = offers[i]._id;
            //Register markers
            $scope.pruneCluster.RegisterMarker(marker);
          }
          //Update markers
          $scope.pruneCluster.ProcessView();
        });
      }
    };

    /**
     * Event when the map has finished loading
     */
    $scope.$on('leafletDirectiveMap.load', function(event){

      leafletData.getMap('search-map-canvas').then(function(map) {
        map.addLayer($scope.pruneCluster);
      });

      //If the zoom is big enough we wait for the map to be loaded with timeout and we get the markers
      if($scope.center.zoom > $scope.minimumZoom) {
        var loadMarkers = function() {
          if(angular.isDefined($scope.bounds.northEast)) {
            $scope.getMarkers();
          }
          else {
            // $timeout does $apply for us
            $timeout(loadMarkers, 10);
          }
        };
        // $timeout does $apply for us
        $timeout(loadMarkers, 10);
      }
    });

    //Set event that fires everytime we finish to move the map
    $scope.$on('leafletDirectiveMap.moveend', function(event){

      //Get markers if zoom is big enough
      if($scope.center.zoom > $scope.minimumZoom) {
            $scope.getMarkers();
      }
      //Otherwise hide the markers
      else {
        $scope.pruneCluster.RemoveMarkers();
        $scope.lastbounds = {
          northEastLng: 0,
          northEastLat: 0,
          southWestLng: 0,
          southWestLat: 0
        };
      }
    });

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
          .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + $scope.searchQuery + '.json?access_token=' + settings.mapbox.publicKey)
          .then(function(response) {

            $scope.searchQuerySearching = false;
            $scope.center = defaultLocation;

            if(response.status === 200 && response.data.features && response.data.features.length > 0) {
              $scope.mapLocate(response.data.features[0]);
            }
            else {
              // @Todo: nicer alert https://github.com/Trustroots/trustroots/issues/24
              if($scope.center.lat === 0 && $scope.center.zoom === 1) {
                $scope.center = defaultLocation;
              }
              $scope.locationNotFound = true;
              $timeout(function(){
                $scope.locationNotFound = false;
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
        //Set a timeout here otherwise the markers will not load.
        $timeout( function () {
          $scope.bounds = leafletBoundsHelpers.createBoundsFromArray([
            [ parseFloat(place.bbox[1]), parseFloat(place.bbox[0]) ],
            [ parseFloat(place.bbox[3]), parseFloat(place.bbox[2]) ]
          ]);
        });
      }
      // Does it have lat/lng?
      else if(place.center) {
        $scope.center = {
          lat: parseFloat(place.center[1]),
          lng: parseFloat(place.center[0]),
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
        .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + val + '.json?access_token=' + settings.mapbox.publicKey)
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


    /*
     * Init search from the URL
     *
     * Note that "replace('_', ' ')" is there to make search queries that are coming in from Hitchwiki/Nomadwiki/Trashwiki work.
     * @link https://github.com/Hitchwiki/hitchwiki/issues/61
     * @link https://github.com/Trustroots/trustroots/issues/113
     */
    if($stateParams.location && $stateParams.location !== '') {
      $scope.searchQuery = $stateParams.location.replace('_', ' ', 'g');
      $scope.searchAddress();
    }
    /*
     * Init opening offer from the URL
     */
    else if($stateParams.offer && $stateParams.offer !== '') {
      Offers.get({
        offerId: $stateParams.offer
      }, function(offer){
        $scope.offer = offer;

        $scope.currentSelection.latlngs = $scope.offer.locationFuzzy;
        $scope.layers.overlays.selectedOffers.visible = true;
        $scope.sidebarOpen = true;

        $scope.center = {
          lat: $scope.offer.locationFuzzy[0],
          lng: $scope.offer.locationFuzzy[1],
          zoom: 13
        };

      },function (error) {
        $scope.center = defaultLocation;
        $scope.offerNotFound = true;
        $timeout(function(){
          $scope.offerNotFound = false;
        }, 3000);
      });
    }
    // Nothing to init from URL
    else {
      $scope.center = defaultLocation;
    }

  }
]);

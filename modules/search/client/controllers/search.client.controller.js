'use strict';

angular.module('search').controller('SearchController', ['$scope', '$http', '$location', '$state', '$stateParams', '$timeout', 'Offers', 'leafletBoundsHelpers', 'Authentication', 'Languages', 'leafletData', 'SettingsFactory', 'messageCenterService', 'MapLayersFactory',
  function($scope, $http, $location, $state, $stateParams, $timeout, Offers, leafletBoundsHelpers, Authentication, Languages, leafletData, SettingsFactory, messageCenterService, MapLayersFactory) {

    var appSettings = SettingsFactory.get();

    // Currently signed in user
    $scope.user = Authentication.user;

    // Default to Europe for now
    var defaultLocation = {
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 6
    };

    $scope.mapLayerstyle = 'street';
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
    $scope.mapMinimumZoom = 4;

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

    // Variables passed to leaflet directive at init
    $scope.mapDefaults = {
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
    $scope.mapCenter = {};
    $scope.mapBounds = {};
    $scope.mapLayers = {
      baselayers: {},
      overlays: {
        selectedOffers: {
          name: 'Selected hosts',
          type: 'group',
          visible: false
        }
      }
    };
    $timeout(function(){
      $scope.mapLayers.baselayers.streets = MapLayersFactory.streets(defaultLocation);
      $scope.mapLayers.baselayers.satellite = MapLayersFactory.satellite(defaultLocation);

      // Other() returns an object consisting possibly multiple layers
      angular.extend($scope.mapLayers.baselayers, MapLayersFactory.other(defaultLocation));
    });

    $scope.mapPaths = {
      selected: $scope.currentSelection
    };
    /**
     * Catch map events:
     * click, dblclick, mousedown, mouseup, mouseover, mouseout, mousemove, contextmenu, focus, blur,
     * preclick, load, unload, viewreset, movestart, move, moveend, dragstart, drag, dragend, zoomstart,
     * zoomend, zoomlevelschange, resize, autopanstart, layeradd, layerremove, baselayerchange, overlayadd,
     * overlayremove, locationfound, locationerror, popupopen, popupclose
     */
    $scope.mapEvents = {
      map: {
        enable: ['click','mousedown', 'moveend', 'load', 'baselayerchange'],
        logic: 'emit'
      }
    };
    $scope.mapLastBounds = {
      northEastLng: 0,
      northEastLat: 0,
      southWestLng: 0,
      southWestLat: 0
    };


    /*
     * Determine currently selected baselayer style
     * 'TRStyle' has to be set when defining layers.
     * Possible values are: street, satellite
     * Defaults to street
     */
    $scope.$on('leafletDirectiveMap.baselayerchange', function(event, layer) {
      $timeout(function() {
        $scope.mapLayerstyle = (layer.leafletEvent.layer.options.TRStyle) ? $scope.mapLayerstyle = layer.leafletEvent.layer.options.TRStyle : 'street';
      });
    });

    // Setting up the cluster
    $scope.pruneCluster = new PruneClusterForLeaflet(60, 60);

    // Setting up the marker and click event
    $scope.pruneCluster.PrepareLeafletMarker = function(leafletMarker, data) {
      leafletMarker.on('click', function(e) {

        // Open offer card
        $scope.offer = Offers.get({
          offerId: data.userId
        });

        // Show cirlce around the marker
        $scope.currentSelection.latlngs = e.latlng;
        $scope.mapLayers.overlays.selectedOffers.visible = true;

        $scope.sidebarOpen = true;

      });
      leafletMarker.setIcon(data.icon);
    };

    // Sidebar & markers react to these events
    $scope.$on('leafletDirectiveMap.click', function(event){
      $scope.sidebarOpen = false;
      $scope.offer = false;
      $scope.mapLayers.overlays.selectedOffers.visible = false;
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
      if(!$scope.mapBounds.northEast || !$scope.user.public) return;

      // If we get out of the boundig box of the last api query we have to call the API for the new markers
      if($scope.mapBounds.northEast.lng > $scope.mapLastBounds.northEastLng || $scope.mapBounds.northEast.lat > $scope.mapLastBounds.northEastLat || $scope.mapBounds.southWest.lng < $scope.mapLastBounds.southWestLng || $scope.mapBounds.southWest.lat < $scope.mapLastBounds.southWestLat) {
        // We add a margin to the boundings depending on the zoom level
        var boundingDelta = 10/$scope.mapCenter.zoom;
        // Saving the current bounding box amd zoom
        $scope.mapLastBounds = {
          northEastLng: $scope.mapBounds.northEast.lng + boundingDelta,
          northEastLat: $scope.mapBounds.northEast.lat + boundingDelta,
          southWestLng: $scope.mapBounds.southWest.lng - boundingDelta,
          southWestLat: $scope.mapBounds.southWest.lat - boundingDelta
        };
        $scope.lastZoom = $scope.mapCenter.zoom;
        // API Call
        Offers.query({
          northEastLng: $scope.mapLastBounds.northEastLng,
          northEastLat: $scope.mapLastBounds.northEastLat,
          southWestLng: $scope.mapLastBounds.southWestLng,
          southWestLat: $scope.mapLastBounds.southWestLat
        }, function(offers){
          // Remove last markers
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
            // Register markers
            $scope.pruneCluster.RegisterMarker(marker);
          }
          // Update markers
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
      if($scope.mapCenter.zoom > $scope.mapMinimumZoom) {
        var loadMarkers = function() {
          if(angular.isDefined($scope.mapBounds.northEast)) {
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

    // Set event that fires everytime we finish to move the map
    $scope.$on('leafletDirectiveMap.moveend', function(event){

      if($scope.mapCenter.zoom > $scope.mapMinimumZoom) {
        $scope.getMarkers();
      }
      // Otherwise hide the markers
      else {
        $scope.pruneCluster.RemoveMarkers();
        $scope.pruneCluster.ProcessView();
        $scope.mapLastBounds = {
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
          .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + $scope.searchQuery + '.json?access_token=' + appSettings.mapbox.publicKey)
          .then(function(response) {

            $scope.searchQuerySearching = false;
            $scope.mapCenter = defaultLocation;

            if(response.status === 200 && response.data.features && response.data.features.length > 0) {
              $scope.mapLocate(response.data.features[0]);
            }
            else {
              // @todo: nicer alert https://github.com/Trustroots/trustroots/wiki/Angular-Directives#flash-messages
              if($scope.mapCenter.lat === 0 && $scope.mapCenter.zoom === 1) {
                $scope.mapCenter = defaultLocation;
              }
              messageCenterService.add('warning', 'We could not find such a place...', { timeout: appSettings.flashTimeout });
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
          $scope.mapBounds = leafletBoundsHelpers.createBoundsFromArray([
            [ parseFloat(place.bbox[1]), parseFloat(place.bbox[0]) ],
            [ parseFloat(place.bbox[3]), parseFloat(place.bbox[2]) ]
          ]);
        });
      }
      // Does it have lat/lng?
      else if(place.center) {
        $scope.mapCenter = {
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
        .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + val + '.json?access_token=' + appSettings.mapbox.publicKey)
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
        $scope.mapLayers.overlays.selectedOffers.visible = true;
        $scope.sidebarOpen = true;

        $scope.mapCenter = {
          lat: $scope.offer.locationFuzzy[0],
          lng: $scope.offer.locationFuzzy[1],
          zoom: 13
        };

      },function (error) {
        $scope.mapCenter = defaultLocation;
        $scope.offerNotFound = true;
        $timeout(function(){
          $scope.offerNotFound = false;
        }, 3000);
      });
    }
    // Nothing to init from URL
    else {
      $scope.mapCenter = defaultLocation;
    }

  }
]);

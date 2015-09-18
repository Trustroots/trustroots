(function() {
  'use strict';

  angular
    .module('search')
    .controller('SearchController', SearchController);

  /* @ngInject */
  function SearchController($scope, $http, $location, $state, $stateParams, $timeout, OffersService, leafletBoundsHelpers, Authentication, Languages, leafletData, messageCenterService, MapLayersFactory, appSettings, localStorageService) {

    // Default to Europe for now
    var defaultLocation = {
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 6
    },
    cacheId = 'search-map-state';

    // Make cache id unique for this user
    if(Authentication.user) {
      cacheId = Authentication.user._id + '.' + cacheId;
    }

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.getMarkers = getMarkers;
    vm.enterSearchAddress = enterSearchAddress;
    vm.searchAddress = searchAddress;
    vm.mapLocate = mapLocate;
    vm.searchSuggestions = searchSuggestions;

    vm.mapLayerstyle = 'street';
    vm.sidebarOpen = false;
    vm.offer = false; // Offer to show
    vm.notFound = false;
    vm.currentSelection = {
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
    vm.mapMinimumZoom = 4;

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
    vm.mapDefaults = {
      attributionControl: false, // Adding this manually below
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
    vm.mapCenter = {};
    vm.mapBounds = {};
    vm.mapLayers = {
      baselayers: {},
      overlays: {
        selectedOffers: {
          name: 'Selected hosts',
          type: 'featureGroup',
          visible: false
        }
      }
    };
    $timeout(function(){
      vm.mapLayers.baselayers.streets = MapLayersFactory.streets(defaultLocation);
      vm.mapLayers.baselayers.satellite = MapLayersFactory.satellite(defaultLocation);

      // Other() returns an object consisting possibly multiple layers
      angular.extend(vm.mapLayers.baselayers, MapLayersFactory.other(defaultLocation));
    });

    vm.mapPaths = {
      selected: vm.currentSelection
    };
    /**
     * Catch map events:
     * click, dblclick, mousedown, mouseup, mouseover, mouseout, mousemove, contextmenu, focus, blur,
     * preclick, load, unload, viewreset, movestart, move, moveend, dragstart, drag, dragend, zoomstart,
     * zoomend, zoomlevelschange, resize, autopanstart, layeradd, layerremove, baselayerchange, overlayadd,
     * overlayremove, locationfound, locationerror, popupopen, popupclose
     */
    vm.mapEvents = {
      map: {
        enable: ['click','mousedown', 'moveend', 'load', 'baselayerchange'],
        logic: 'emit'
      }
    };
    vm.mapLastBounds = {
      northEastLng: 0,
      northEastLat: 0,
      southWestLng: 0,
      southWestLat: 0
    };

    /**
     * Add attribution controller
     */
    leafletData.getMap('search-map-canvas').then(function(map) {
      map.addControl(L.control.attribution({
        position: 'bottomright',
        prefix: ''
      }));
    });

    /*
     * Determine currently selected baselayer style
     * 'TRStyle' has to be set when defining layers.
     * Possible values are: street, satellite
     * Defaults to street
     */
    $scope.$on('leafletDirectiveMap.baselayerchange', function(event, layer) {
      $timeout(function() {
        vm.mapLayerstyle = (layer.leafletEvent.layer.options.TRStyle) ? layer.leafletEvent.layer.options.TRStyle : 'street';
      });
    });

    /**
     * Setting up marker clustering
     */
    vm.pruneCluster = new PruneClusterForLeaflet(60, 60);

    /**
     * Setting up the marker and click event
     */
    vm.pruneCluster.PrepareLeafletMarker = function(leafletMarker, data) {
      leafletMarker.on('click', function(e) {

        // Open offer card
        vm.offer = OffersService.get({
          offerId: data.userId
        });

        // Show cirlce around the marker
        vm.currentSelection.latlngs = e.latlng;
        vm.mapLayers.overlays.selectedOffers.visible = true;

        vm.sidebarOpen = true;

      });
      leafletMarker.setIcon(data.icon);
    };

    /**
     * Sidebar & markers react to these events
     */
    $scope.$on('leafletDirectiveMap.click', function(event){
      vm.sidebarOpen = false;
      vm.offer = false;
      vm.mapLayers.overlays.selectedOffers.visible = false;
    });

    /**
     * Load markers to the current bounding box
     */
    function getMarkers() {

      // Don't proceed if:
      // - Map does not have bounds set (typically at map init these might be missing for some milliseconds)
      // - If user isn't public(confirmed) yet - no need to hit API just to get 401
      if(!vm.mapBounds.northEast || !Authentication.user.public) return;

      // If we get out of the boundig box of the last api query we have to call the API for the new markers
      if(vm.mapBounds.northEast.lng > vm.mapLastBounds.northEastLng || vm.mapBounds.northEast.lat > vm.mapLastBounds.northEastLat || vm.mapBounds.southWest.lng < vm.mapLastBounds.southWestLng || vm.mapBounds.southWest.lat < vm.mapLastBounds.southWestLat) {
        // We add a margin to the boundings depending on the zoom level
        var boundingDelta = 10/vm.mapCenter.zoom;
        // Saving the current bounding box amd zoom
        vm.mapLastBounds = {
          northEastLng: vm.mapBounds.northEast.lng + boundingDelta,
          northEastLat: vm.mapBounds.northEast.lat + boundingDelta,
          southWestLng: vm.mapBounds.southWest.lng - boundingDelta,
          southWestLat: vm.mapBounds.southWest.lat - boundingDelta
        };
        vm.lastZoom = vm.mapCenter.zoom;
        // API Call
        OffersService.query({
          northEastLng: vm.mapLastBounds.northEastLng,
          northEastLat: vm.mapLastBounds.northEastLat,
          southWestLng: vm.mapLastBounds.southWestLng,
          southWestLat: vm.mapLastBounds.southWestLat
        }, function(offers){
          // Remove last markers
          vm.pruneCluster.RemoveMarkers();
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
            vm.pruneCluster.RegisterMarker(marker);
          }
          // Update markers
          vm.pruneCluster.ProcessView();
        });
      }
    }

    /**
     * Event when the map has finished loading
     */
    $scope.$on('leafletDirectiveMap.load', function(event) {

      // Check for cached map state and move map to there if found
      var cachedMapState = localStorageService.get(cacheId);

      if(cachedMapState && cachedMapState.lat && cachedMapState.lng && cachedMapState.zoom) {
        vm.mapCenter = {
          lat: parseFloat(cachedMapState.lat),
          lng: parseFloat(cachedMapState.lng),
          zoom: parseInt(cachedMapState.zoom)
        };
      }

      leafletData.getMap('search-map-canvas').then(function(map) {
        map.addLayer(vm.pruneCluster);
      });

      //If the zoom is big enough we wait for the map to be loaded with timeout and we get the markers
      if(vm.mapCenter.zoom > vm.mapMinimumZoom) {
        var loadMarkers = function() {
          if(angular.isDefined(vm.mapBounds.northEast)) {
            getMarkers();
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
    $scope.$on('leafletDirectiveMap.moveend', function(event) {

      if(vm.mapCenter.zoom > vm.mapMinimumZoom) {
        getMarkers();
      }
      // Otherwise hide the markers
      else {
        vm.pruneCluster.RemoveMarkers();
        vm.pruneCluster.ProcessView();
        vm.mapLastBounds = {
          northEastLng: 0,
          northEastLat: 0,
          southWestLng: 0,
          southWestLat: 0
        };
      }

      saveMapState();
    });

    /**
     * Map address search
     */
    vm.searchQuery = '';
    vm.searchQuerySearching = false;
    function enterSearchAddress(event) {
      // enter = 13 or 10 depending on browser
      if (event.which === 13 || event.which === 10) {
        event.preventDefault();
        searchAddress();
      }
    }
    function searchAddress() {
      if(vm.searchQuery !== '' && appSettings.mapbox && appSettings.mapbox.publicKey) {
        vm.searchQuerySearching = true;

        $http
          .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + vm.searchQuery + '.json?access_token=' + appSettings.mapbox.publicKey)
          .then(function(response) {

            vm.searchQuerySearching = false;
            vm.mapCenter = defaultLocation;

            if(response.status === 200 && response.data && response.data.features && response.data.features.length > 0) {
              mapLocate(response.data.features[0]);
            }
            else {
              if(vm.mapCenter.lat === 0 && vm.mapCenter.zoom === 1) {
                vm.mapCenter = defaultLocation;
              }
              messageCenterService.add('warning', 'We could not find such a place...');
            }
          });

      }
    }


    /**
     * Show geo location at map
     * Used also when selecting search suggestions from the suggestions list
     */
    function mapLocate(place) {

      // Show full place name at search  query
      vm.searchQuery = placeTitle(place);
      // Does the place have bounding box?
      if(place.bbox) {
        //Set a timeout here otherwise the markers will not load.
        $timeout( function () {
          vm.mapBounds = leafletBoundsHelpers.createBoundsFromArray([
            [ parseFloat(place.bbox[1]), parseFloat(place.bbox[0]) ],
            [ parseFloat(place.bbox[3]), parseFloat(place.bbox[2]) ]
          ]);
        });
      }
      // Does it have lat/lng?
      else if(place.center) {
        vm.mapCenter = {
          lat: parseFloat(place.center[1]),
          lng: parseFloat(place.center[0]),
          zoom: 5
        };
      }
      // Failed to pinpoint location to the map
      else {
        messageCenterService.add('warning', 'We could not find such a place...');
      }
    }

    /**
     * Store map state with localStorageService for later use
     * @todo: add layer here
     */
    function saveMapState() {
      localStorageService.set(cacheId, {
        'lat': vm.mapCenter.lat,
        'lng': vm.mapCenter.lng,
        'zoom': vm.mapCenter.zoom
      });
    }

    /**
     * Search field's typeahead -suggestions
     *
     * @link https://www.mapbox.com/developers/api/geocoding/
     */
    function searchSuggestions(val) {
      if(appSettings.mapbox && appSettings.mapbox.publicKey) {
        return $http
          .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + val + '.json?access_token=' + appSettings.mapbox.publicKey)
          .then(function(response) {
            vm.searchQuerySearching = false;
            if(response.status === 200 && response.data && response.data.features && response.data.features.length > 0) {
              return response.data.features.map(function(place){
                place.trTitle = placeTitle(place);
                return place;
              });
            }
            else return [];
          });
      }
      else {
        return [];
      }
    }

    /*
     * Compile a nice title for the place, eg. "Jyväskylä, Finland"
     */
    function placeTitle(place) {
      var title = '';

      if(place.place_name) title += place.place_name;
      else if(place.text) title += place.text;

      return title;
    }


    /*
     * Init search from the URL
     *
     * Note that "replace('_', ' ')" is there to make search queries that are coming in from Hitchwiki/Nomadwiki/Trashwiki work.
     * @link https://github.com/Hitchwiki/hitchwiki/issues/61
     * @link https://github.com/Trustroots/trustroots/issues/113
     */
    if($stateParams.location && $stateParams.location !== '') {
      vm.searchQuery = $stateParams.location.replace('_', ' ', 'g');
      searchAddress();
    }
    // Init opening offer from the URL
    else if($stateParams.offer && $stateParams.offer.length === 24) {
      OffersService.get({
        offerId: $stateParams.offer
      }, function(offer){
        vm.offer = offer;

        vm.currentSelection.latlngs = vm.offer.location;
        vm.mapLayers.overlays.selectedOffers.visible = true;
        vm.sidebarOpen = true;

        vm.mapCenter = {
          lat: vm.offer.location[0],
          lng: vm.offer.location[1],
          zoom: 13
        };

      },
      // Offer not found
      function (error) {
        vm.mapCenter = defaultLocation;
        vm.offerNotFound = true;
        $timeout(function(){
          vm.offerNotFound = false;
        }, 3000);
      });
    }
    // Nothing to init from URL
    else {
      vm.mapCenter = defaultLocation;
    }

  }

})();

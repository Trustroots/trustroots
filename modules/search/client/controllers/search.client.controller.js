(function () {
  'use strict';

  angular
    .module('search')
    .controller('SearchController', SearchController);

  /* @ngInject */
  function SearchController($scope, $http, $q, $stateParams, $timeout, $analytics, OffersService, leafletBoundsHelpers, Authentication, leafletData, messageCenterService, MapLayersFactory, appSettings, locker, LocationService) {

    // `search-map-canvas` is id of <leaflet> element
    var mapId = 'search-map-canvas';

    // Prefix for Leaflet events
    // @link https://github.com/angular-ui/ui-leaflet/commit/d22b3f0
    var listenerPrefix = 'leafletDirectiveMap.' + mapId;

    // Make cache id unique for this user
    var cachePrefix = (Authentication.user) ? 'search.mapCenter.' + Authentication.user._id : 'search.mapCenter';

    // Default location for all TR maps,
    // Returns `{lat: Float, lng: Float, zoom: 6}`
    var defaultLocation = LocationService.getDefaultLocation(6);

    // Return constructed icon
    // @link http://leafletjs.com/reference.html#icon
    var icon = function(status) {
      status = (status === 'yes') ? 'yes' : 'maybe';
      return L.icon({
        iconUrl: '/modules/core/img/map/marker-icon-' + status + '.svg',
        iconSize: [20, 20], // size of the icon
        iconAnchor: [10, 10] // point of the icon which will correspond to marker's location
      });
    };

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.getMarkers = getMarkers;
    vm.enterSearchAddress = enterSearchAddress;
    vm.searchAddress = searchAddress;
    vm.mapLocate = mapLocate;
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
    vm.mapBounds = {};
    vm.mapLayers = {
      baselayers: MapLayersFactory.getLayers({ streets: true, satellite: true, outdoors: true }),
      overlays: {
        selectedOffers: {
          name: 'Selected hosts',
          type: 'group',
          visible: false
        }
      }
    };
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
        enable: ['click', 'mousedown', 'moveend', 'load', 'baselayerchange'],
        logic: 'emit'
      }
    };
    vm.mapLastBounds = {
      northEastLng: 0,
      northEastLat: 0,
      southWestLng: 0,
      southWestLat: 0
    };

    activate();

    /**
     * Initialize controller
     */
    function activate() {

      /**
       * Set map location
       */
      getMapCenter().then(function(location) {
        vm.mapCenter = location;
      });

      /**
       * Add attribution controller
       */
      leafletData.getMap(mapId).then(function(map) {
        map.addControl(L.control.attribution({
          position: 'bottomright',
          prefix: ''
        }));
      });

      /**
       * Determine currently selected baselayer style
       * 'TRStyle' has to be set when defining layers.
       * Possible values are: street, satellite
       * Defaults to street
       */
      $scope.$on(listenerPrefix + '.baselayerchange', function(event, layer) {
        $analytics.eventTrack('baselayerchange', {
          category: 'search.map',
          label: layer.leafletEvent.name
        });
        $timeout(function() {
          vm.mapLayerstyle = (layer.leafletEvent.layer.options.TRStyle) ? layer.leafletEvent.layer.options.TRStyle : 'streets';
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

          $analytics.eventTrack('offer.preview', {
            category: 'search.map',
            label: 'Preview offer'
          });

        });
        leafletMarker.setIcon(data.icon);
      };

      /**
       * Sidebar & markers react to these events
       */
      $scope.$on(listenerPrefix + '.click', function() {
        vm.sidebarOpen = false;
        vm.offer = false;
        vm.mapLayers.overlays.selectedOffers.visible = false;
      });

    }

    /**
     * Return map location from cache or fallback to default location
     */
    function getMapCenter() {
      return $q(function(resolve) {

        // Is local/sessionStorage supported? This might fail in browser's incognito mode
        if (locker.supported()) {
          // Get location from cache, return `false` if it doesn't exist in locker
          var cachedLocation = locker.get(cachePrefix, false);

          // Validate cached location or fall back to default
          // If it's older than two days, we won't use it.
          if (cachedLocation &&
             cachedLocation.lat &&
             cachedLocation.lng &&
             cachedLocation.zoom &&
             isFinite(cachedLocation.lat) &&
             isFinite(cachedLocation.lng) &&
             isFinite(cachedLocation.zoom) &&
             cachedLocation.date &&
             moment().diff(moment(cachedLocation.date), 'days') < 2) {
            resolve(cachedLocation);
          } else {
            // No cached location found, it was invalid or it was outdated
            resolve(defaultLocation);
          }

          // Make sure there's something in locker for the next time
          // If the key already exists in locker, then no action will
          // be taken and false will be returned
          locker.add(cachePrefix, defaultLocation);
        } else {
          // When local/sessionStorage is not supported, use default location:
          resolve(defaultLocation);
        }

      });
    }

    /**
     * Load markers to the current bounding box
     */
    function getMarkers() {

      // Don't proceed if:
      // - Map does not have bounds set (typically at map init these might be missing for some milliseconds)
      // - If user isn't public(confirmed) yet - no need to hit API just to get 401
      if (!vm.mapBounds.northEast || !Authentication.user.public) return;

      // If we get out of the boundig box of the last api query we have to call the API for the new markers
      if (vm.mapBounds.northEast.lng > vm.mapLastBounds.northEastLng || vm.mapBounds.northEast.lat > vm.mapLastBounds.northEastLat || vm.mapBounds.southWest.lng < vm.mapLastBounds.southWestLng || vm.mapBounds.southWest.lat < vm.mapLastBounds.southWestLat) {
        // We add a margin to the boundings depending on the zoom level
        var boundingDelta = 10 / vm.mapCenter.zoom;
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
        }, function(offers) {
          // Remove last markers
          // eslint-disable-next-line new-cap
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
            // eslint-disable-next-line new-cap
            vm.pruneCluster.RegisterMarker(marker);
          }
          // Update markers
          // eslint-disable-next-line new-cap
          vm.pruneCluster.ProcessView();
        });
      }
    }

    /**
     * Event when the map has finished loading
     */
    $scope.$on(listenerPrefix + '.load', function() {

      leafletData.getMap(mapId).then(function(map) {
        map.addLayer(vm.pruneCluster);
      });

      // If the zoom is big enough we wait for the map to be loaded with timeout and we get the markers
      if (vm.mapCenter.zoom > vm.mapMinimumZoom) {
        var loadMarkers = function() {
          if (angular.isDefined(vm.mapBounds.northEast)) {
            getMarkers();
          } else {
            // $timeout does $apply for us
            $timeout(loadMarkers, 10);
          }
        };
        // $timeout does $apply for us
        $timeout(loadMarkers, 10);
      }
    });

    // Set event that fires everytime we finish to move the map
    $scope.$on(listenerPrefix + '.moveend', function() {

      if (vm.mapCenter.zoom > vm.mapMinimumZoom) {
        getMarkers();
      } else {
        // Otherwise hide the markers...

        /* eslint-disable new-cap */
        vm.pruneCluster.RemoveMarkers();
        vm.pruneCluster.ProcessView();
        /* eslint-enable new-cap */

        vm.mapLastBounds = {
          northEastLng: 0,
          northEastLat: 0,
          southWestLng: 0,
          southWestLat: 0
        };
      }

      // Save new map state to the cache
      // We could also just save `vm.mapCenter`, but it might have Angular related rubbish in it
      locker.put(cachePrefix, {
        'lat': vm.mapCenter.lat,
        'lng': vm.mapCenter.lng,
        'zoom': vm.mapCenter.zoom,
        'date': new Date()
      });

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
      if (vm.searchQuery !== '' && appSettings.mapbox && appSettings.mapbox.publicKey) {
        $http.get(
          '//api.mapbox.com/geocoding/v5/mapbox.places/' + vm.searchQuery + '.json'
          + '?access_token=' + appSettings.mapbox.publicKey
          + '&types=country,region,place,locality,neighborhood',
          {
            ignoreLoadingBar: true
          })
          .then(function(response) {
            if (response.status === 200 && response.data && response.data.features && response.data.features.length > 0) {
              mapLocate(response.data.features[0]);
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
      if (place.bbox) {
        // Set a timeout here otherwise the markers will not load.
        $timeout(function() {
          vm.mapBounds = leafletBoundsHelpers.createBoundsFromArray([
            [parseFloat(place.bbox[1]), parseFloat(place.bbox[0])],
            [parseFloat(place.bbox[3]), parseFloat(place.bbox[2])]
          ]);
        });
      } else if (place.center) {
        vm.mapCenter = {
          lat: parseFloat(place.center[1]),
          lng: parseFloat(place.center[0]),
          zoom: 5
        };
      } else {
        // Failed to pinpoint location to the map
        messageCenterService.add('warning', 'We could not find such a place...');
      }
    }

    /**
     * Compile a nice title for the place, eg. "Helsinki, Finland" or "Chinatown, New York, United States"
     */
    function placeTitle(place) {
      var title = '';

      if (place.text) {
        title = place.text;

        // Relevant context strings
        if (place.context) {
          var contextLength = place.context.length;
          for (var i = 0; i < contextLength; i++) {
            if (place.context[i].id.substring(0, 6) === 'place.') {
              title += ', ' + place.context[i].text;
            } else if (place.context[i].id.substring(0, 8) === 'country.') {
              title += ', ' + place.context[i].text;
            }
          }
        }
      } else if (place.place_name) {
        title = place.place_name;
      }

      return title;
    }


    /*
     * Init search from the URL
     *
     * Note that "replace('_', ' ')" is there to make search queries that are coming in from Hitchwiki/Nomadwiki/Trashwiki work.
     * @link https://github.com/Hitchwiki/hitchwiki/issues/61
     * @link https://github.com/Trustroots/trustroots/issues/113
     */
    if ($stateParams.location && $stateParams.location !== '') {
      vm.searchQuery = $stateParams.location.replace('_', ' ', 'g');
      searchAddress();
    } else if ($stateParams.offer && $stateParams.offer.length === 24) {

      // Initializing opening offer from the URL

      OffersService.get({
        offerId: $stateParams.offer
      }, function(offer) {
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
      // Offer not found or other error
      function() {
        messageCenterService.add('danger', 'Sorry, we did not find what you are looking for!');
        $analytics.eventTrack('offer-not-found', {
          category: 'search.map',
          label: 'Offer not found'
        });
      });
    }

  }

}());

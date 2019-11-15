(function () {
  angular
    .module('search')
    .controller('SearchMapController', SearchMapController);

  /* @ngInject */
  function SearchMapController($scope, $state, $stateParams, $timeout, $analytics, OffersService, Authentication, leafletData, messageCenterService, MapLayersFactory, MapMarkersFactory, SearchMapService, FiltersService) {

    // `search-map-canvas` is id of <leaflet> element
    var mapId = 'search-map-canvas';

    // Prefix for Leaflet events
    // @link https://github.com/angular-ui/ui-leaflet/commit/d22b3f0
    var listenerPrefix = 'leafletDirectiveMap.' + mapId;

    // ViewModel
    var vm = this;

    // Exposed to the view
    vm.pruneCluster = new PruneClusterForLeaflet(60, 60);
    vm.mapLayerstyle = 'street';
    vm.notFound = false;
    vm.mapCenter = false;
    vm.currentSelection = MapMarkersFactory.getOfferCircle({
      layer: 'selectedOffers'
    });

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
      zoomControl: false, // Adding this manually below
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
        enable: ['click', 'moveend', 'load', 'baselayerchange'],
        logic: 'emit'
      }
    };
    vm.mapLastBounds = {
      northEastLng: 0,
      northEastLat: 0,
      southWestLng: 0,
      southWestLat: 0
    };

    // Init
    activate();

    /**
     * Initialize controller
     */
    function activate() {

      // Set map's initial location
      SearchMapService.getMapCenter().then(function (mapCenter) {
        vm.mapCenter = mapCenter;
      });

      // Wait for Leaflet object
      leafletData.getMap(mapId).then(function (map) {

        // Add map scale
        map.addControl(L.control.scale({
          position: 'bottomright'
        }));

        // Add map zoom control (+/- buttons)
        map.addControl(L.control.zoom({
          position: 'bottomright'
        }));

        // Add map attribution
        map.addControl(L.control.attribution({
          position: 'bottomright',
          prefix: ''
        }));

        // Set active area to accommodate sidebar
        // @link https://github.com/Mappy/Leaflet-active-area
        map.setActiveArea('search-map-active-area');
      });

      // Set Leaflet listeners
      $scope.$on(listenerPrefix + '.baselayerchange', onBaseLayerChange);
      $scope.$on(listenerPrefix + '.load', onLeafletLoad);
      $scope.$on(listenerPrefix + '.moveend', onLeafletMoveEnd);
      $scope.$on(listenerPrefix + '.click', closeOffer);

      // If offer gets closed elsewhere
      $scope.$on('search.closeOffer', function () {
        vm.mapLayers.overlays.selectedOffers.visible = false;

        // Set history state + URL without reloading the view
        setOfferUrl('');
      });

      // Listen to new map location values from other controllers
      $scope.$on('search.mapCenter', function (event, mapCenter) {
        vm.mapCenter = mapCenter;
      });
      $scope.$on('search.mapBounds', function (event, mapBounds) {
        vm.mapBounds = mapBounds;
      });

      // Listen to other controllers
      $scope.$on('search.resetMarkers', resetMarkers);

      // Setting up the marker and click event
      vm.pruneCluster.PrepareLeafletMarker = function (leafletMarker, data) {

        // Set offer icon if not set yet
        if (!leafletMarker.options.iconSet) {
          leafletMarker.setIcon(data.icon);
          leafletMarker.options.iconSet = true;
        }

        // Handle click events
        if (!leafletMarker.listens('click')) {
          leafletMarker.on('click', function ($event) {

            $scope.$emit('search.loadingOffer');

            // Load offer details
            OffersService
              .get({ offerId: data.offerId })
              .$promise
              .then(function (offer) {
                previewOffer(offer, false, $event);
              })
              .catch(function () {
                closeOffer();
                messageCenterService.add('danger', 'Something went wrong. Make sure you are connected to internet and try again. ');
              });
          });
        }
      };

      // Initializing either location search or offer
      // Center map to the offer, if there is one
      if ($stateParams.offer && $scope.$parent.search.offer) {
        $scope.$parent.search.offer
          .$promise
          .then(function (offer) {
            previewOffer(offer, true);
          });
      }

    }

    /**
     * Open hosting offer
     */
    function previewOffer(offer, reCenterMap, $event) {
      if (offer.location) {
        // Let parent controller handle setting this to scope
        $scope.$emit('search.previewOffer', offer);

        // Set history state + URL without reloading the view
        setOfferUrl(offer._id);

        // Position circle
        // If (click) event was passed to us, use coordinates from that.
        // This is because on map the dot is always at `fuzzyLocation`, but for
        // `offer` we have real location when user is owner of that `offer`.
        // Otherwise circle would be off for user's own markers.
        vm.currentSelection.latlngs = $event && $event.latlng ? $event.latlng : offer.location;

        // Make circle visible
        vm.mapLayers.overlays.selectedOffers.visible = true;

        // Re-position map
        if (reCenterMap) {
          vm.mapCenter = {
            // See above explanation for using `$event` coordinates
            lat: $event && $event.latlng ? $event.latlng.lat : offer.location[0],
            lng: $event && $event.latlng ? $event.latlng.lng : offer.location[1],
            zoom: 13
          };
        }
        $analytics.eventTrack('offer.preview', {
          category: 'search.map',
          label: 'Preview offer'
        });
      }
    }


    /**
     * Close hosting offer
     */
    function closeOffer() {
      vm.mapLayers.overlays.selectedOffers.visible = false;
      $scope.$emit('search.closeOffer');
    }

    /**
     * Set URL history state without reloading the page
     */
    function setOfferUrl(offerId) {
      $state.go(
        'search.map',
        { offer: offerId || '' },
        {
          location: true, // will update the url in the location bar,
          inherit: true, // will inherit url parameters from current url.
          notify: false, // will not broadcast $stateChangeStart and $stateChangeSuccess events.
          reload: false // will not force transition even if no state or params have changed
        }
      );
    }

    /**
     * Force refresh markers on map
     */
    function resetMarkers() {
      getMarkers(true);
    }

    /**
     * Load markers to the current bounding box
     */
    function getMarkers(forcedRefresh) {

      // Don't proceed if:
      // - Map does not have bounds set (typically at map init these might be missing for some milliseconds)
      // - If user isn't public(confirmed) yet - no need to hit API just to get 401
      if (!vm.mapBounds.northEast || !Authentication.user.public) return;

      // Don't do anything on too big zoom levels
      if (vm.mapCenter.zoom <= vm.mapMinimumZoom) {
        return;
      }

      // If we get out of the boundig box of the last api query we have to call the API for the new markers
      // Note also `forcedRefresh`, in which case previous bounding box is ignored
      if (forcedRefresh ||
          vm.mapBounds.northEast.lng > vm.mapLastBounds.northEastLng ||
          vm.mapBounds.northEast.lat > vm.mapLastBounds.northEastLat ||
          vm.mapBounds.southWest.lng < vm.mapLastBounds.southWestLng ||
          vm.mapBounds.southWest.lat < vm.mapLastBounds.southWestLat) {

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
        // @TODO: cancel any pending queries:
        // @link https://code.angularjs.org/1.5.11/docs/api/ngResource/service/$resource#cancelling-requests
        OffersService.query({
          northEastLng: vm.mapLastBounds.northEastLng,
          northEastLat: vm.mapLastBounds.northEastLat,
          southWestLng: vm.mapLastBounds.southWestLng,
          southWestLat: vm.mapLastBounds.southWestLat,
          filters: FiltersService.get()
        }, function (offers) {

          // Remove last markers
          // eslint-disable-next-line new-cap
          vm.pruneCluster.RemoveMarkers();

          // Let's go through those markers
          // This loop might look weird but it's actually speed optimized :P
          for (var i = -1, len = offers.length; ++i < len;) {
            var marker = new PruneCluster.Marker(
              offers[i].location[0],
              offers[i].location[1]
            );

            marker.data.icon = MapMarkersFactory.getIcon(offers[i]);
            marker.data.offerId = offers[i]._id;

            // Register markers
            // eslint-disable-next-line new-cap
            vm.pruneCluster.RegisterMarker(marker);
          }

          // Update markers
          // eslint-disable-next-line new-cap
          vm.pruneCluster.ProcessView();
        }, function () {
          messageCenterService.add('danger', 'Sorry, something went wrong. Please try again.');
        });
      }
    }

    /**
     * When Leaflet map has loaded
     */
    function onLeafletLoad() {
      leafletData.getMap(mapId).then(function (map) {
        map.addLayer(vm.pruneCluster);
      });

      // If the zoom is big enough we wait for the map to be loaded with timeout and we get the markers
      if (vm.mapCenter.zoom > vm.mapMinimumZoom) {
        var loadMarkers = function () {
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
    }

    /**
     * When moving the map has ended. Fires also on zoom changes.
     */
    function onLeafletMoveEnd() {
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

      SearchMapService.cacheMapCenter(vm.mapCenter);
    }

    /**
     * When Leaflet base layer changes
     */
    function onBaseLayerChange(event, layer) {
      $analytics.eventTrack('baselayerchange', {
        category: 'search.map',
        label: layer.leafletEvent.name
      });
      // Determine currently selected baselayer style 'TRStyle' has to be
      // set when defining layers. Possible values are: street, satellite
      // Defaults to street
      $timeout(function () {
        vm.mapLayerstyle = (layer.leafletEvent.layer.options.TRStyle) ? layer.leafletEvent.layer.options.TRStyle : 'streets';
      });
    }

  }
}());

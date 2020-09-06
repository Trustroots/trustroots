angular.module('search').controller('SearchMapController', SearchMapController);

/* @ngInject */
function SearchMapController(
  $scope,
  $state,
  $stateParams,
  // $timeout,
  $analytics,
  OffersService,
  // Authentication,
  // leafletData,
  messageCenterService,
  MapLayersFactory,
  MapMarkersFactory,
  SearchMapService,
  // FiltersService,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.pruneCluster = {}; // new PruneClusterForLeaflet(60, 60);
  vm.mapLayerstyle = 'street';
  vm.notFound = false;
  vm.mapCenter = false;
  vm.closeOffer = closeOffer;
  vm.previewOffer = previewOffer;
  vm.currentSelection = MapMarkersFactory.getOfferCircle({
    layer: 'selectedOffers',
  });

  vm.mapMinimumZoom = 4;
  vm.mapBounds = {};
  vm.mapLayers = {
    baselayers: MapLayersFactory.getLayers({
      streets: true,
      satellite: true,
      outdoors: true,
    }),
    overlays: {
      selectedOffers: {
        name: 'Selected hosts',
        type: 'group',
        visible: false,
      },
    },
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
        collapsed: true,
      },
    },
  };
  vm.mapPaths = {
    selected: vm.currentSelection,
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
      logic: 'emit',
    },
  };
  vm.mapLastBounds = {
    northEastLng: 0,
    northEastLat: 0,
    southWestLng: 0,
    southWestLat: 0,
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
          OffersService.get({ offerId: data.offerId })
            .$promise.then(function (offer) {
              previewOffer(offer, false, $event);
            })
            .catch(function () {
              closeOffer();
              messageCenterService.add(
                'danger',
                'Something went wrong. Make sure you are connected to internet and try again. ',
              );
            });
        });
      }
    };

    // Initializing either location search or offer
    // Center map to the offer, if there is one
    if ($stateParams.offer && $scope.$parent.search.offer) {
      $scope.$parent.search.offer.$promise.then(function (offer) {
        previewOffer(offer, true);
      });
    }
  }

  /**
   * Open hosting offer
   */
  function previewOffer(offer, reCenterMap, $event) {
    console.log('Angular-previewOffer:', offer); //eslint-disable-line
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
      vm.currentSelection.latlngs =
        $event && $event.latlng ? $event.latlng : offer.location;

      // Make circle visible
      vm.mapLayers.overlays.selectedOffers.visible = true;

      // Re-position map
      if (reCenterMap) {
        vm.mapCenter = {
          // See above explanation for using `$event` coordinates
          lat: $event && $event.latlng ? $event.latlng.lat : offer.location[0],
          lng: $event && $event.latlng ? $event.latlng.lng : offer.location[1],
          zoom: 13,
        };
      }
      $analytics.eventTrack('offer.preview', {
        category: 'search.map',
        label: 'Preview offer',
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
        reload: false, // will not force transition even if no state or params have changed
      },
    );
  }
}

angular.module('search').controller('SearchMapController', SearchMapController);

/* @ngInject */
function SearchMapController(
  $scope,
  $state,
  $stateParams,
  $analytics,
  SearchMapService,
  FiltersService,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.bounds = {};
  vm.center = {};
  vm.filters = {};
  vm.notFound = false;
  vm.closeOffer = closeOffer;
  vm.previewOffer = previewOffer;

  // Init
  activate();

  /**
   * Initialize controller
   */
  function activate() {
    const filters = FiltersService.get();
    vm.filters = filters;

    // Set map's initial location
    SearchMapService.getMapCenter().then(center => {
      vm.center = center;
    });

    // If offer gets closed elsewhere
    $scope.$on('search.closeOffer', () => {
      // Set history state + URL without reloading the view
      setOfferUrl('');
    });

    // Listen to new map location values from other controllers
    $scope.$on('search.mapCenter', (event, center) => {
      console.log('Angular got center:', center); //eslint-disable-line
      vm.center = center;
    });
    $scope.$on('search.mapBounds', (event, bounds) => {
      console.log('Angular got bounds:', bounds); //eslint-disable-line
      vm.bounds = bounds;
    });
    // eslint-disable-next-line
    $scope.$on('search.filtersUpdated', (event, filters) => {
      console.log('angular map cntrl got filters event'); //eslint-disable-line
      vm.filters = filters;
    });

    // Initializing either location search or offer
    // Center map to the offer, if there is one
    if ($stateParams.offer && $scope.$parent.search.offer) {
      $scope.$parent.search.offer.$promise.then(offer => {
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

      // Re-position map
      if (reCenterMap) {
        vm.center = {
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

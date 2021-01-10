angular.module('search').controller('SearchMapController', SearchMapController);

/* @ngInject */
function SearchMapController(
  $scope,
  $state,
  $stateParams,
  $analytics,
  FiltersService,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  vm.bounds = {};
  vm.location = {};
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
    vm.filters = angular.toJson(filters);

    // If offer gets closed elsewhere
    $scope.$on('search.closeOffer', () => {
      // Set history state + URL without reloading the view
      setOfferUrl('');
    });

    // Listen to new map location values from other controllers
    $scope.$on('search.mapCenter', (event, location) => {
      vm.location = location;
    });

    $scope.$on('search.mapBounds', (event, bounds) => {
      vm.bounds = bounds;
    });

    $scope.$on('search.filtersUpdated', (event, filters) => {
      vm.filters = angular.toJson(filters);
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
  function previewOffer(offer, reCenterMap) {
    if (offer.location) {
      // Let parent controller handle setting this to scope
      $scope.$emit('search.previewOffer', offer);

      // Set history state + URL without reloading the view
      setOfferUrl(offer._id);

      // Re-position map
      if (reCenterMap) {
        vm.location = {
          lat: offer.location[0],
          lng: offer.location[1],
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

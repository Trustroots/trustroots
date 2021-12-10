angular
  .module('offers')
  .controller('OfferHostEditController', OfferHostEditController);

/* @ngInject */
function OfferHostEditController(
  $window,
  $state,
  $stateParams,
  $analytics,
  $timeout,
  leafletData,
  OffersService,
  Authentication,
  messageCenterService,
  offers,
  defaultLocation,
  $scope,
  $filter,
) {
  // ViewModel
  const vm = this;

  vm.offers = offers;

  // Expoxed to the view
  vm.leafletData = leafletData;
  vm.editOffer = editOffer;
  vm.mapCenter = defaultLocation;
  vm.searchQuery = '';
  vm.isLoading = true;
  vm.firstTimeAround = false;
  vm.invalidateMapSize = invalidateMapSize;
  vm.isDescriptionTooShort = false;

  activate();

  /**
   * Initialize controller
   */
  function activate() {
    const defaultOfferConfig = {
      type: 'host',
      status: 'yes',
      description: '',
      noOfferDescription: '',
      location: defaultLocation,
      maxGuests: 1,
      showOnlyInMyCircles: false,
    };

    // Make sure offer is there
    offers.$promise
      .then(
        function () {
          if (angular.isArray(offers) && offers.length) {
            vm.offer = new OffersService(
              angular.extend(defaultOfferConfig, offers[0]),
            );

            // Populate map
            if (
              angular.isArray(vm.offer.location) &&
              vm.offer.location.length === 2
            ) {
              vm.mapCenter.lat = parseFloat(vm.offer.location[0]);
              vm.mapCenter.lng = parseFloat(vm.offer.location[1]);
              vm.mapCenter.zoom = 16;
            }
          }
        },
        function (err) {
          // No previous offer, fill in defaults
          if (err && err.status === 404) {
            // Creating new hosting offer, set defaults
            vm.offer = new OffersService(defaultOfferConfig);

            // Show guidance
            vm.firstTimeAround = true;

            // Locale map to user's living- or from- location, if they're set
            if (
              Authentication.user.locationLiving &&
              Authentication.user.locationLiving !== ''
            ) {
              vm.searchQuery = Authentication.user.locationLiving;
            } else if (
              Authentication.user.locationFrom &&
              Authentication.user.locationFrom !== ''
            ) {
              vm.searchQuery = Authentication.user.locationFrom;
            }
          } else {
            vm.offer = false;
          }
        },
      )
      // Always execute this on both error and success
      .finally(function () {
        setStatusByURL();
        vm.isLoading = false;
      });
  }

  $scope.$watch('offerHostEdit.offer.description', function (newValue) {
    vm.isDescriptionTooShort = $filter('plainTextLength')(newValue) < 5;
  });

  /**
   * Invalidate map size on tab change
   * Map has been hidden until this point and Leaflet couldn't calculate
   * tile positions properly until it's visible in DOM
   */
  function invalidateMapSize() {
    $timeout(function () {
      leafletData.getMap().then(function (map) {
        // @link http://leafletjs.com/reference-1.2.0.html#map-invalidatesize
        map.invalidateSize(false);
      });
    });
  }

  /**
   * Determine new hosting status from the URL parameter
   * Overrides any previous status
   */
  function setStatusByURL() {
    if (
      $stateParams.status &&
      ['yes', 'maybe', 'no'].indexOf($stateParams.status) > -1
    ) {
      vm.offer.status = $stateParams.status;
    }
  }

  /**
   * Add offer
   */
  function editOffer() {
    if (vm.isLoading) {
      return;
    }

    vm.isLoading = true;

    // Pick location from the map
    vm.offer.location = [
      parseFloat(vm.mapCenter.lat),
      parseFloat(vm.mapCenter.lng),
    ];

    vm.offer.createOrUpdate().then(successCallback).catch(errorCallback);

    function successCallback() {
      vm.isLoading = false;
      $analytics.eventTrack('offer-modified', {
        category: 'offer.edit',
        label: 'Modified offer',
        value: vm.offer.status,
      });
      if ($window.innerWidth < 768) {
        $state.go('profile.accommodation', {
          username: Authentication.user.username,
        });
      } else {
        $state.go('profile.about', { username: Authentication.user.username });
      }
    }

    function errorCallback(res) {
      vm.isLoading = false;
      const errorMessage =
        res && res.data && res.data.message
          ? res.data.message
          : 'Snap! Something went wrong. If this keeps happening, please contact us.';
      messageCenterService.add('danger', errorMessage);
    }
  }
}

(function () {
  'use strict';

  angular
    .module('offers')
    .controller('OffersEditController', OffersEditController);

  /* @ngInject */
  function OffersEditController($http, $timeout, $state, $stateParams, $location, leafletBoundsHelpers, OffersService, Authentication, messageCenterService, MapLayersFactory, offer, appSettings, LocationService) {

    // Default location for all TR maps,
    // Returns `{lat: Float, lng: Float, zoom: 4}`
    var defaultLocation = LocationService.getDefaultLocation(4);

    // ViewModel
    var vm = this;

    // Expoxed to the view
    vm.offer = {};
    vm.addOffer = addOffer;
    vm.mapLocate = mapLocate;
    vm.searchAddress = searchAddress;
    vm.searchQuery = '';
    vm.searchQuerySearching = false;
    vm.isLoading = false;
    vm.firstTimeAround = false;

    // Leaflet
    vm.mapCenter = defaultLocation;
    vm.mapLayers = {
      baselayers: MapLayersFactory.getLayers({ streets: true, satellite: true, outdoors: false })
    };
    vm.mapDefaults = {
      scrollWheelZoom: false,
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

    /**
     * Initialize controller
     */
    init();
    function init() {

      // Make sure offer is there
      offer.$promise.then(function() {

        vm.offer = offer;

        // Populate map if user ralready has an offer
        if (vm.offer && vm.offer.location) {
          vm.mapCenter.lat = parseFloat(vm.offer.location[0]);
          vm.mapCenter.lng = parseFloat(vm.offer.location[1]);
          vm.mapCenter.zoom = 16;
        }

        setHostingStatusByURL();

      },
      // No previous offer, fill in defaults
      function() {

        vm.offer.maxGuests = 1;
        vm.offer.status = 'yes';

        // Show guidance
        vm.firstTimeAround = true;

        // Locale map to user's living- or from- location, if they're set
        if (Authentication.user.locationLiving && Authentication.user.locationLiving !== '') {
          vm.searchQuery = Authentication.user.locationLiving;
        } else if (Authentication.user.locationFrom && Authentication.user.locationFrom !== '') {
          vm.searchQuery = Authentication.user.locationFrom;
        }
        searchAddress();

        setHostingStatusByURL();
      });

    }

    /**
     * Determine new hosting status from the URL parameter
     * Overrides any previous status
     */
    function setHostingStatusByURL() {
      if ($stateParams.status && jQuery.inArray($stateParams.status, ['yes', 'maybe', 'no']) > -1) {
        vm.offer.status = $stateParams.status;
      }
    }

    /**
     * Add offer
     */
    function addOffer() {
      vm.isLoading = true;

      var newOffer = new OffersService({
        status: vm.offer.status,
        description: vm.offer.description,
        noOfferDescription: vm.offer.noOfferDescription,
        location: [parseFloat(vm.mapCenter.lat), parseFloat(vm.mapCenter.lng)],
        maxGuests: parseInt(vm.offer.maxGuests, 10)
      });

      newOffer.$save(function() {
        // Done!
        vm.isLoading = false;
        $state.go('profile.about', { username: Authentication.user.username });
      }, function(err) {
        vm.isLoading = false;
        var errorMessage = (err.data.message) ? err.data.message : 'Error occured. Please try again.';
        messageCenterService.add('danger', errorMessage);
      });

    }

    /**
     * Center map to the address in query input
     */
    function searchAddress() {
      if (vm.searchQuery !== '') {
        vm.searchQuerySearching = true;

        $http
          .get('//api.mapbox.com/geocoding/v5/mapbox.places/' + vm.searchQuery + '.json?access_token=' + appSettings.mapbox.publicKey)
          .then(function(response) {

            vm.searchQuerySearching = false;

            if (response.status === 200 && response.data.features && response.data.features.length > 0) {
              mapLocate(response.data.features[0]);
            } else {
              messageCenterService.add('danger', 'Cannot find that place.');
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
        vm.mapBounds = leafletBoundsHelpers.createBoundsFromArray([
          [parseFloat(place.bbox[1]), parseFloat(place.bbox[0])],
          [parseFloat(place.bbox[3]), parseFloat(place.bbox[2])]
        ]);
      } else if (place.center) {
        vm.mapCenter = {
          lat: parseFloat(place.center[0]),
          lng: parseFloat(place.center[1]),
          zoom: 5
        };
      }

    }

    /**
     * Compile a nice title for the place, eg. "Jyväskylä, Finland"
     */
    function placeTitle(place) {
      var title = '';

      if (place.place_name) title += place.place_name;
      else if (place.text) title += place.text;

      return title;
    }

  }

}());

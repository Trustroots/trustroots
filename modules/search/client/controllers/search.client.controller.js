(function () {
  'use strict';

  angular
    .module('search')
    .controller('SearchController', SearchController);

  /* @ngInject */
  function SearchController($scope, $window, $analytics, $stateParams, offer, tribe, Authentication, FiltersService, messageCenterService) {

    // ViewModel
    var vm = this;

    // Exposed to the view
    // Sidebar visible: registered users on bigger screens
    // Sidebar hidden: on small screens and un-registered users
    vm.isSidebarOpen = ($stateParams.offer && offer) || (Authentication.user && Authentication.user.public && $window.innerWidth >= 768);
    vm.screenWidth = $window.innerWidth;
    vm.offer = offer || false;
    vm.filters = FiltersService.get();
    vm.toggleSidebar = toggleSidebar;
    vm.onPlaceSearch = onPlaceSearch;

    // Init search from the URL, `tr-location` directive attached
    // to search input will take care of the rest.
    // `Replacing underscore with space is to make search queries
    // coming from Hitchwiki/Nomadwiki/Trashwiki work
    // @link https://github.com/Hitchwiki/hitchwiki/issues/61
    // @link https://github.com/Trustroots/trustroots/issues/113
    vm.initializeSearch = ($stateParams.location && $stateParams.location !== '') ? $stateParams.location.replace('_', ' ', 'g') : false;

    activate();

    /**
     * Initialize controller
     */
    function activate() {
      // If tribe was requested from URL, set it active
      if (tribe && tribe._id) {
        vm.filters.tribes = [tribe._id];
        FiltersService.set('tribes', [tribe._id]);
      }

      // Watch for changes at tribes filters
      $scope.$watchCollection('search.filters.tribes', function(newTribeFilters, oldTribeFilters) {
        if (!angular.equals(newTribeFilters, oldTribeFilters)) {
          // Save new value to cache
          FiltersService.set('tribes', newTribeFilters);
          // Close possible open offers
          if (vm.offer) {
            vm.offer = false;
            // Tells `SearchMapController` and `SearchSidebarController`
            // to close anything offer related
            $scope.$broadcast('search.closeOffer');
          }
          // Tells map controller to reset markers
          $scope.$broadcast('search.resetMarkers');
        }
      });

      // `SearchMap` controller sends these signals down to this controller
      $scope.$on('search.loadingOffer', function() {
        vm.offer = false;
        vm.loadingOffer = true;
      });
      $scope.$on('search.previewOffer', function(event, offer) {
        vm.offer = offer;
        vm.loadingOffer = false;
        vm.isSidebarOpen = true;
      });
      $scope.$on('search.closeOffer', function() {
        vm.offer = false;
      });

      // Initializing either location search or offer
      if ($stateParams.offer && !vm.offer) {
        // Offer not found or other error
        messageCenterService.add('danger', 'Sorry, we did not find what you are looking for.');
        $analytics.eventTrack('offer-not-found', {
          category: 'search.map',
          label: 'Offer not found'
        });
      }

    }

    /**
     * Broadcast information about changed search location
     */
    function onPlaceSearch(data, type) {
      if (data && type === 'center') {
        $scope.$broadcast('search.mapCenter', data);
      } else if (data && type === 'bounds') {
        $scope.$broadcast('search.mapBounds', data);
      }
    }

    function toggleSidebar() {
      vm.isSidebarOpen = !vm.isSidebarOpen;
      // Closing sidebar, close offer
      if (!vm.isSidebarOpen) {
        $scope.$broadcast('search.closeOffer');
      }
    }


  }

}());

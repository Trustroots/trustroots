angular.module('search').controller('SearchController', SearchController);

/* @ngInject */
function SearchController(
  $scope,
  $window,
  $analytics,
  $stateParams,
  $timeout,
  offer,
  tribe,
  Authentication,
  FiltersService,
  messageCenterService,
  LocationService,
) {
  // ViewModel
  const vm = this;

  // Exposed to the view
  // Sidebar visible: registered users on bigger screens
  // Sidebar hidden: on small screens and un-registered users
  vm.isSidebarOpen =
    ($stateParams.offer && offer) ||
    (Authentication.user &&
      Authentication.user.public &&
      $window.innerWidth >= 768);
  vm.screenWidth = $window.innerWidth;
  vm.offer = offer || false;
  vm.filters = FiltersService.get();
  vm.toggleSidebar = toggleSidebar;
  vm.closeSidebar = closeSidebar;
  vm.openSidebar = openSidebar;
  vm.onPlaceSearch = onPlaceSearch;
  vm.openSearchPlaceInput = openSearchPlaceInput;
  vm.onLanguageFiltersChange = onLanguageFiltersChange;
  vm.onSeenFilterChange = onSeenFilterChange;
  vm.onlineInPast6Months = vm.filters.seen && vm.filters.seen.months === 6;
  vm.sidebarTab = 'filters';

  // Visibility toggle for search place input on small screens
  vm.isPlaceSearchVisible = false;

  // Init search from the URL, `tr-location` directive attached
  // to search input will take care of the rest.
  // `Replacing underscore with space is to make search queries
  // coming from Hitchwiki/Nomadwiki/Trashwiki work
  // @link https://github.com/Hitchwiki/hitchwiki/issues/61
  // @link https://github.com/Trustroots/trustroots/issues/113
  vm.searchQuery = $stateParams.location
    ? $stateParams.location.replace('_', ' ', 'g').replace('+', ' ', 'g')
    : '';

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

    if (
      angular.isDefined(vm.searchQuery) &&
      angular.isString(vm.searchQuery) &&
      vm.searchQuery
    ) {
      LocationService.suggestions(vm.searchQuery).then(function (suggestions) {
        if (suggestions.length) {
          const bounds = LocationService.getBounds(suggestions[0]);
          onPlaceSearch(bounds, 'bounds');
          vm.searchQuery = suggestions[0].trTitle;
        }
      });
    }

    // Watch for changes at types filters
    $scope.$watchCollection(
      'search.filters.types',
      function (newTypesFilters, oldTypesFilters) {
        if (!angular.equals(newTypesFilters, oldTypesFilters)) {
          // Save new value to cache
          FiltersService.set('types', newTypesFilters);
          onFiltersUpdated();
        }
      },
    );

    // Watch for changes at tribes filters
    $scope.$watchCollection(
      'search.filters.tribes',
      function (newTribeFilters, oldTribeFilters) {
        if (!angular.equals(newTribeFilters, oldTribeFilters)) {
          // Save new value to cache
          FiltersService.set('tribes', newTribeFilters);
          onFiltersUpdated();
        }
      },
    );

    // `SearchMap` controller sends these signals down to this controller
    $scope.$on('search.loadingOffer', function () {
      vm.offer = false;
      vm.loadingOffer = true;
    });
    $scope.$on('search.previewOffer', function (event, offer) {
      vm.offer = offer;
      vm.loadingOffer = false;
      openSidebar('results');
    });
    $scope.$on('search.closeOffer', function () {
      vm.offer = false;
      vm.loadingOffer = false;
    });

    // Initializing either location search or offer
    if ($stateParams.offer && !vm.offer) {
      // Offer not found or other error
      messageCenterService.add(
        'danger',
        'Sorry, we did not find what you are looking for.',
      );
      $analytics.eventTrack('offer-not-found', {
        category: 'search.map',
        label: 'Offer not found',
      });
    }
  }

  /**
   * Fired for changes at languages filters
   */
  function onLanguageFiltersChange() {
    // `vm.filters.languages` is still out of sync at this point,
    // but in next cycle after `$timeout` we have updated version.
    $timeout(function () {
      // Save new value to cache
      FiltersService.set('languages', vm.filters.languages || []);

      onFiltersUpdated();
    });
  }

  /**
   * Fired for changes at seen filter
   */
  function onSeenFilterChange() {
    vm.filters.seen.months = vm.onlineInPast6Months ? 6 : 24;

    // `vm.filters.seen` is still out of sync at this point,
    // but in next cycle after `$timeout` we have updated version.
    $timeout(function () {
      // Save new value to cache
      FiltersService.set('seen', vm.filters.seen);

      onFiltersUpdated();
    });
  }

  /**
   * Closes offer when filters are changed and updates the map
   */
  function onFiltersUpdated() {
    // Close possible open offers
    if (vm.offer) {
      vm.offer = false;
      // Tells `SearchMapController` and `SearchSidebarController`
      // to close anything offer related
      $scope.$broadcast('search.closeOffer');
    }
    $scope.$broadcast('search.filtersUpdated', vm.filters);
  }

  /**
   * Open search place input on small screens
   */
  function openSearchPlaceInput() {
    vm.isPlaceSearchVisible = true;

    closeSidebar();

    $timeout(function () {
      // Focus to search input
      angular.element('#search-query').focus();
    });
  }

  /**
   * Broadcast information about changed search location
   */
  function onPlaceSearch(data, type) {
    vm.isPlaceSearchVisible = false;

    if (data && type === 'center') {
      $scope.$broadcast('search.mapCenter', data);
    } else if (data && type === 'bounds') {
      $scope.$broadcast('search.mapBounds', data);
    }
  }

  /**
   * Toggles search results / filters sidebar
   */
  function toggleSidebar(activeTab) {
    if (vm.isSidebarOpen) {
      closeSidebar(activeTab);
    } else {
      openSidebar(activeTab);
    }
  }

  /**
   * Close search results / filters sidebar
   */
  function closeSidebar(activeTab) {
    vm.isSidebarOpen = false;

    // Close offer(s)
    $scope.$broadcast('search.closeOffer');

    // Activate specific tab
    if (activeTab) {
      vm.sidebarTab = activeTab;
    }
  }

  /**
   * Open search results / filters sidebar
   */
  function openSidebar(activeTab) {
    vm.isSidebarOpen = true;

    // Activate specific tab
    if (activeTab) {
      vm.sidebarTab = activeTab;
    }
  }
}

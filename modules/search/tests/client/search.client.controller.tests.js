import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('SearchController', function () {
  let $controller;
  let $q;
  let $rootScope;
  let $timeout;

  const defaultFilters = {
    languages: [],
    seen: {
      months: 6,
    },
    tribes: [],
    types: ['host', 'meet'],
  };

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$controller_, _$q_, _$rootScope_, _$timeout_) {
    $controller = _$controller_;
    $q = _$q_;
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
  }));

  function createController(options = {}) {
    const $scope = $rootScope.$new();
    const filters = angular.copy(options.filters || defaultFilters);
    const bounds = options.bounds || {
      northEast: { lat: 61, lng: 25 },
      southWest: { lat: 60, lng: 24 },
    };
    const suggestions = options.suggestions || [];
    const $analytics = {
      eventTrack: jasmine.createSpy('$analytics.eventTrack'),
    };
    const FiltersService = {
      get: jasmine
        .createSpy('FiltersService.get')
        .and.callFake(key => (key ? filters[key] : filters)),
      set: jasmine.createSpy('FiltersService.set'),
    };
    const LocationService = {
      getBounds: jasmine
        .createSpy('LocationService.getBounds')
        .and.returnValue(bounds),
      suggestions: jasmine
        .createSpy('LocationService.suggestions')
        .and.returnValue($q.resolve(suggestions)),
    };
    const messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };
    const Authentication = {
      user: options.user || null,
    };
    const $window = {
      innerWidth: options.innerWidth || 1024,
    };
    const $stateParams = options.stateParams || {};

    spyOn($scope, '$broadcast').and.callThrough();

    const controller = $controller('SearchController as search', {
      $analytics,
      $scope,
      $stateParams,
      $timeout,
      $window,
      Authentication,
      FiltersService,
      LocationService,
      messageCenterService,
      offer: options.offer || false,
      tribe: options.tribe || false,
    });

    return {
      $analytics,
      $scope,
      Authentication,
      bounds,
      controller,
      FiltersService,
      LocationService,
      messageCenterService,
    };
  }

  it('opens the sidebar for public desktop users and hydrates cached filters', function () {
    const filters = {
      communityNotes: true,
      languages: ['en'],
      seen: {
        months: 6,
      },
      tribes: ['cyclists'],
      types: ['host'],
    };

    const { controller } = createController({
      filters,
      innerWidth: 1024,
      user: {
        public: true,
      },
    });

    expect(controller.isSidebarOpen).toBe(true);
    expect(controller.screenWidth).toBe(1024);
    expect(controller.filters).toEqual(filters);
    expect(controller.onlineInPast6Months).toBe(true);
    expect(controller.communityNotesEnabled).toBe(true);
    expect(controller.sidebarTab).toBe('filters');
  });

  it('starts a URL place search and broadcasts the resolved map bounds', function () {
    const suggestion = {
      trTitle: 'San Francisco Bay',
    };
    const { $scope, bounds, controller, LocationService } = createController({
      stateParams: {
        location: 'San+Francisco_Bay',
      },
      suggestions: [suggestion],
    });

    expect(controller.searchQuery).toBe('San Francisco Bay');

    $rootScope.$digest();

    expect(LocationService.suggestions).toHaveBeenCalledWith(
      'San Francisco Bay',
    );
    expect(LocationService.getBounds).toHaveBeenCalledWith(suggestion);
    expect(controller.searchQuery).toBe('San Francisco Bay');
    expect($scope.$broadcast).toHaveBeenCalledWith('search.mapBounds', bounds);
  });

  it('keeps URL place searches idle when no suggestions are found', function () {
    const { $scope, controller, LocationService } = createController({
      stateParams: {
        location: 'Unknown+Place',
      },
      suggestions: [],
    });

    $rootScope.$digest();

    expect(LocationService.suggestions).toHaveBeenCalledWith('Unknown Place');
    expect(LocationService.getBounds).not.toHaveBeenCalled();
    expect(controller.searchQuery).toBe('Unknown Place');
    expect($scope.$broadcast).not.toHaveBeenCalledWith(
      'search.mapBounds',
      jasmine.anything(),
    );
  });

  it('applies a tribe resolved from the URL to the active filters', function () {
    const filters = angular.copy(defaultFilters);
    const { controller, FiltersService } = createController({
      filters,
      tribe: {
        _id: 'hitchhikers',
      },
    });

    expect(controller.filters.tribes).toEqual(['hitchhikers']);
    expect(FiltersService.set).toHaveBeenCalledWith('tribes', ['hitchhikers']);
  });

  it('persists changed type and tribe filters and updates the map', function () {
    const { $scope, controller, FiltersService } = createController();

    $rootScope.$digest();
    FiltersService.set.calls.reset();
    $scope.$broadcast.calls.reset();

    controller.filters.types = ['meet'];
    $scope.$digest();

    expect(FiltersService.set).toHaveBeenCalledWith('types', ['meet']);
    expect($scope.$broadcast).toHaveBeenCalledWith(
      'search.filtersUpdated',
      controller.filters,
    );

    FiltersService.set.calls.reset();
    $scope.$broadcast.calls.reset();

    controller.filters.tribes = ['families'];
    $scope.$digest();

    expect(FiltersService.set).toHaveBeenCalledWith('tribes', ['families']);
    expect($scope.$broadcast).toHaveBeenCalledWith(
      'search.filtersUpdated',
      controller.filters,
    );
  });

  it('persists language and seen filters while closing an open offer', function () {
    const offer = {
      _id: 'offer-1',
    };
    const { $scope, controller, FiltersService } = createController({ offer });

    controller.onLanguageFiltersChange(['en', 'pt']);

    expect(controller.offer).toBe(false);
    expect(FiltersService.set).toHaveBeenCalledWith('languages', ['en', 'pt']);
    expect($scope.$broadcast).toHaveBeenCalledWith('search.closeOffer');
    expect($scope.$broadcast).toHaveBeenCalledWith(
      'search.filtersUpdated',
      controller.filters,
    );

    FiltersService.set.calls.reset();
    $scope.$broadcast.calls.reset();
    controller.onlineInPast6Months = false;

    controller.onSeenFilterChange();
    $timeout.flush();

    expect(controller.filters.seen.months).toBe(24);
    expect(FiltersService.set).toHaveBeenCalledWith('seen', {
      months: 24,
    });
    expect($scope.$broadcast).toHaveBeenCalledWith(
      'search.filtersUpdated',
      controller.filters,
    );
  });

  it('persists the default recent-seen filter when the six-month toggle is on', function () {
    const { controller, FiltersService } = createController();

    controller.onlineInPast6Months = true;

    controller.onSeenFilterChange();
    $timeout.flush();

    expect(controller.filters.seen.months).toBe(6);
    expect(FiltersService.set).toHaveBeenCalledWith('seen', {
      months: 6,
    });
  });

  it('persists community notes toggle changes while closing open community notes', function () {
    const { $scope, controller, FiltersService } = createController();
    controller.communityNote = {
      plusCode: '9F2X+3Q',
    };
    controller.communityNotesEnabled = true;

    controller.onCommunityNotesToggle();

    expect(controller.communityNote).toBe(false);
    expect(FiltersService.set).toHaveBeenCalledWith('communityNotes', true);
    expect($scope.$broadcast).toHaveBeenCalledWith('search.closeOffer');
    expect($scope.$broadcast).toHaveBeenCalledWith(
      'search.filtersUpdated',
      controller.filters,
    );
  });

  it('toggles community notes from the mobile map controls', function () {
    const { controller, FiltersService } = createController();
    controller.communityNotesEnabled = true;

    controller.toggleCommunityNotes();

    expect(controller.communityNotesEnabled).toBe(false);
    expect(FiltersService.set).toHaveBeenCalledWith('communityNotes', false);
  });

  it('broadcasts map center when place search returns center coordinates', function () {
    const { $scope, controller } = createController();
    const center = { lat: 52.5, lng: 13.4 };

    $scope.$broadcast.calls.reset();

    controller.onPlaceSearch(center, 'center');

    expect($scope.$broadcast).toHaveBeenCalledWith('search.mapCenter', center);
  });

  it('broadcasts map bounds and ignores empty place search results', function () {
    const { $scope, bounds, controller } = createController();

    $scope.$broadcast.calls.reset();

    controller.onPlaceSearch(bounds, 'bounds');
    controller.onPlaceSearch(null, 'bounds');

    expect($scope.$broadcast).toHaveBeenCalledTimes(1);
    expect($scope.$broadcast).toHaveBeenCalledWith('search.mapBounds', bounds);
  });

  it('opens the mobile place input, closes the sidebar, and focuses search', function () {
    const focus = jasmine.createSpy('focus');
    const angularElement = spyOn(angular, 'element').and.returnValue({ focus });
    const { $scope, controller } = createController({
      user: { public: true },
    });

    controller.openSearchPlaceInput();
    $timeout.flush();

    expect(controller.isPlaceSearchVisible).toBe(true);
    expect(controller.isSidebarOpen).toBe(false);
    expect($scope.$broadcast).toHaveBeenCalledWith('search.closeOffer');
    expect(angularElement).toHaveBeenCalledWith('#search-query');
    expect(focus).toHaveBeenCalled();
  });

  it('toggles the sidebar without replacing the active tab when no tab is supplied', function () {
    const { controller } = createController();

    controller.sidebarTab = 'results';
    controller.toggleSidebar();

    expect(controller.isSidebarOpen).toBe(true);
    expect(controller.sidebarTab).toBe('results');
  });

  it('toggles sidebar states through both branches of the sidebar helpers', function () {
    const { $scope, controller } = createController({
      user: { public: true },
      innerWidth: 1024,
    });

    $scope.$broadcast.calls.reset();
    controller.toggleSidebar('filters');

    expect(controller.isSidebarOpen).toBe(false);
    expect(controller.sidebarTab).toBe('filters');
    expect($scope.$broadcast).toHaveBeenCalledWith('search.closeOffer');

    $scope.$broadcast.calls.reset();
    controller.toggleSidebar('results');

    expect(controller.isSidebarOpen).toBe(true);
    expect(controller.sidebarTab).toBe('results');
    expect($scope.$broadcast).not.toHaveBeenCalledWith('search.closeOffer');
  });

  it('responds to map offer events from nested controllers', function () {
    const offer = {
      _id: 'offer-2',
    };
    const { $scope, controller } = createController();

    $scope.$broadcast('search.loadingOffer');
    expect(controller.offer).toBe(false);
    expect(controller.loadingOffer).toBe(true);

    $scope.$broadcast('search.previewOffer', offer);
    expect(controller.offer).toBe(offer);
    expect(controller.communityNote).toBe(false);
    expect(controller.loadingOffer).toBe(false);
    expect(controller.isSidebarOpen).toBe(true);
    expect(controller.sidebarTab).toBe('results');

    $scope.$broadcast('search.previewCommunityNote', {
      notes: [{ id: 'note-1' }],
      plusCode: '9F2X+3Q',
    });
    expect(controller.offer).toBe(false);
    expect(controller.communityNote).toEqual({
      notes: [{ id: 'note-1' }],
      plusCode: '9F2X+3Q',
    });
    expect(controller.loadingOffer).toBe(false);
    expect(controller.isSidebarOpen).toBe(true);
    expect(controller.sidebarTab).toBe('results');

    $scope.$broadcast('search.closeOffer');
    expect(controller.offer).toBe(false);
    expect(controller.communityNote).toBe(false);
    expect(controller.loadingOffer).toBe(false);
  });

  it('reports a missing offer requested from the URL', function () {
    const { $analytics, messageCenterService } = createController({
      stateParams: {
        offer: '507f1f77bcf86cd799439011',
      },
    });

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Sorry, we did not find what you are looking for.',
    );
    expect($analytics.eventTrack).toHaveBeenCalledWith('offer-not-found', {
      category: 'search.map',
      label: 'Offer not found',
    });
  });
});

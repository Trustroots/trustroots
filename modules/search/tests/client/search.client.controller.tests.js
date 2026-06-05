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
      get: jasmine.createSpy('FiltersService.get').and.returnValue(filters),
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
    expect(controller.loadingOffer).toBe(false);
    expect(controller.isSidebarOpen).toBe(true);
    expect(controller.sidebarTab).toBe('results');

    $scope.$broadcast('search.closeOffer');
    expect(controller.offer).toBe(false);
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

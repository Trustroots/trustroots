import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('SearchMapController', function () {
  let $controller;
  let $q;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$controller_, _$q_, _$rootScope_) {
    $controller = _$controller_;
    $q = _$q_;
    $rootScope = _$rootScope_;
  }));

  function createController(options = {}) {
    const parentScope = $rootScope.$new();
    const $scope = parentScope.$new();
    const $analytics = {
      eventTrack: jasmine.createSpy('$analytics.eventTrack'),
    };
    const $state = {
      go: jasmine.createSpy('$state.go'),
    };
    const filters = options.filters || {
      languages: ['en'],
      seen: {
        months: 6,
      },
      tribes: ['cyclists'],
      types: ['host'],
    };
    const FiltersService = {
      get: jasmine.createSpy('FiltersService.get').and.returnValue(filters),
    };

    parentScope.search = options.parentSearch || {};
    spyOn($scope, '$emit').and.callThrough();

    const controller = $controller('SearchMapController as searchMap', {
      $analytics,
      $scope,
      $state,
      $stateParams: options.stateParams || {},
      FiltersService,
    });

    return {
      $analytics,
      $scope,
      $state,
      controller,
      filters,
      parentScope,
    };
  }

  it('serializes initial filters and reacts to map and filter broadcasts', function () {
    const { $scope, controller, filters } = createController();
    const center = {
      lat: 60.17,
      lng: 24.94,
      zoom: 12,
    };
    const bounds = {
      northEast: {
        lat: 61,
        lng: 25,
      },
      southWest: {
        lat: 60,
        lng: 24,
      },
    };
    const updatedFilters = {
      languages: ['pt'],
      seen: {
        months: 24,
      },
      tribes: [],
      types: ['meet'],
    };

    expect(controller.filters).toBe(angular.toJson(filters));

    $scope.$broadcast('search.mapCenter', center);
    expect(controller.location).toBe(center);

    $scope.$broadcast('search.mapBounds', bounds);
    expect(controller.bounds).toBe(bounds);

    $scope.$broadcast('search.filtersUpdated', updatedFilters);
    expect(controller.filters).toBe(angular.toJson(updatedFilters));
  });

  it('previews offers with locations and updates map history', function () {
    const offer = {
      _id: 'offer-1',
      location: [60.17, 24.94],
    };
    const { $analytics, $scope, $state, controller } = createController();

    controller.previewOffer(offer, true);

    expect($scope.$emit).toHaveBeenCalledWith('search.previewOffer', offer);
    expect($state.go).toHaveBeenCalledWith(
      'search.map',
      {
        offer: 'offer-1',
      },
      {
        inherit: true,
        location: true,
        notify: false,
        reload: false,
      },
    );
    expect(controller.location).toEqual({
      lat: 60.17,
      lng: 24.94,
      zoom: 13,
    });
    expect($analytics.eventTrack).toHaveBeenCalledWith('offer.preview', {
      category: 'search.map',
      label: 'Preview offer',
    });
  });

  it('previews offers without recentering the map when recentering is disabled', function () {
    const offer = {
      _id: 'offer-1',
      location: [60.17, 24.94],
    };
    const { controller } = createController();
    controller.location = {
      lat: 50,
      lng: 10,
      zoom: 5,
    };

    controller.previewOffer(offer, false);

    expect(controller.location).toEqual({
      lat: 50,
      lng: 10,
      zoom: 5,
    });
  });

  it('skips URL offer preview when the resolved offer is unavailable', function () {
    const { $state } = createController({
      stateParams: {
        offer: 'offer-2',
      },
    });

    $rootScope.$digest();

    expect($state.go).not.toHaveBeenCalled();
  });

  it('ignores previews for offers without a location', function () {
    const { $analytics, $scope, $state, controller } = createController();

    controller.previewOffer(
      {
        _id: 'offer-without-location',
      },
      true,
    );

    expect($scope.$emit).not.toHaveBeenCalled();
    expect($state.go).not.toHaveBeenCalled();
    expect($analytics.eventTrack).not.toHaveBeenCalled();
  });

  it('clears the offer URL when closing the active offer', function () {
    const { $scope, $state, controller } = createController();

    controller.closeOffer();

    expect($scope.$emit).toHaveBeenCalledWith('search.closeOffer');
    expect($state.go).toHaveBeenCalledWith(
      'search.map',
      {
        offer: '',
      },
      {
        inherit: true,
        location: true,
        notify: false,
        reload: false,
      },
    );
  });

  it('previews an offer resolved from the URL', function () {
    const offer = {
      _id: 'offer-2',
      location: [61, 25],
    };
    const { $analytics, $state, controller } = createController({
      parentSearch: {
        offer: {
          $promise: $q.resolve(offer),
        },
      },
      stateParams: {
        offer: 'offer-2',
      },
    });

    $rootScope.$digest();

    expect($state.go).toHaveBeenCalledWith(
      'search.map',
      {
        offer: 'offer-2',
      },
      jasmine.any(Object),
    );
    expect(controller.location).toEqual({
      lat: 61,
      lng: 25,
      zoom: 13,
    });
    expect($analytics.eventTrack).toHaveBeenCalledWith(
      'offer.preview',
      jasmine.any(Object),
    );
  });
});

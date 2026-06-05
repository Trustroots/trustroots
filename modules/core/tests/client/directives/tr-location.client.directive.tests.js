import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-location.client.directive';

describe('trLocation directive', function () {
  let $compile;
  let $rootScope;
  let $timeout;
  let $q;
  let LocationService;
  let originalWindowInnerWidth;

  beforeEach(function () {
    LocationService = {
      suggestions: jasmine.createSpy('suggestions'),
      getBounds: jasmine.createSpy('getBounds'),
      getCenter: jasmine.createSpy('getCenter'),
    };

    originalWindowInnerWidth = window.innerWidth;
    window.innerWidth = 1024;

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('LocationService', LocationService);
    });
  });

  beforeEach(inject(function (_$compile_, _$rootScope_, _$timeout_, _$q_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
    $q = _$q_;
  }));

  afterEach(function () {
    window.innerWidth = originalWindowInnerWidth;
  });

  function compile(overrides = {}, attrs = '') {
    const scope = $rootScope.$new();
    scope.locationQuery = '';
    scope.locationCenter = {};
    scope.locationBounds = {};
    scope.locationChange = jasmine.createSpy('locationChange');
    Object.assign(scope, overrides);

    const element = $compile(
      `<input type="text" tr-location ng-model="locationQuery" ${attrs} />`,
    )(scope);
    scope.$digest();

    return {
      element,
      elementScope: element.isolateScope(),
      controller: element.controller('trLocation'),
      scope,
    };
  }

  it('binds autocomplete and defaults input attribute values', function () {
    const { element } = compile({}, '');

    expect(element.attr('typeahead-min-length')).toBe('3');
    expect(element.attr('typeahead-wait-ms')).toBe('300');
    expect(element.attr('typeahead-on-select')).toBe(
      'trLocation.onSelect($item, $model, $label, $event)',
    );
  });

  it('passes country/region/place/locality types when limits are requested', function () {
    LocationService.suggestions.and.returnValue($q.when([]));

    const { controller } = compile({}, '');

    controller.searchSuggestions(
      'Par',
      '$viewValue, "country,region,place,locality,neighborhood"',
    );

    expect(LocationService.suggestions).toHaveBeenCalledWith(
      'Par',
      '$viewValue, "country,region,place,locality,neighborhood"',
    );
    expect(controller).toBeDefined();
  });

  it('toggles skipSuggestions on enter key events', function () {
    const { element, elementScope } = compile({}, '');

    element.triggerHandler({
      type: 'keydown',
      which: 13,
      preventDefault: jasmine.createSpy('preventDefault'),
    });

    expect(elementScope.skipSuggestions).toBe(true);
    expect(elementScope.trLocationNotfound).toBe(false);

    element.triggerHandler({
      type: 'keypress',
      which: 40,
      preventDefault: jasmine.createSpy('preventDefault'),
    });

    expect(elementScope.skipSuggestions).toBe(false);
  });

  it('returns suggestions and keeps the selected query when not skipping suggestions', function (done) {
    const suggestions = [
      { trTitle: 'Helsinki' },
      { trTitle: 'Helsinki Central' },
    ];
    LocationService.suggestions.and.returnValue($q.resolve(suggestions));

    const { controller, elementScope } = compile({}, '');

    controller.searchSuggestions('Hel').then(function (result) {
      expect(result).toEqual(suggestions);
      expect(elementScope.trLocationNotfound).toBe(false);
      expect(elementScope.value).toBe('');
      done();
    }, done.fail);

    $rootScope.$apply();
  });

  it('uses first suggestion immediately when skipping suggestions', function (done) {
    const suggestions = [{ trTitle: 'Riga' }];
    LocationService.suggestions.and.returnValue($q.resolve(suggestions));
    LocationService.getBounds.and.returnValue({
      northEast: {
        lat: 57,
        lng: 24,
      },
      southWest: {
        lat: 56,
        lng: 23,
      },
    });
    LocationService.getCenter.and.returnValue({
      lat: 56.95,
      lng: 24.1,
    });

    const { controller, elementScope, scope } = compile(
      {
        locationBounds: {},
      },
      'tr-location-bounds="locationBounds"',
    );

    elementScope.skipSuggestions = true;
    scope.locationChange = jasmine.createSpy('locationChange');

    controller.searchSuggestions('Ri').then(function (result) {
      expect(result).toEqual([]);
      expect(elementScope.value).toBe('Riga');
      expect(LocationService.getBounds).toHaveBeenCalledWith(
        jasmine.objectContaining({
          trTitle: 'Riga',
        }),
      );
      done();
    }, done.fail);

    $rootScope.$apply();
  });

  it('sets not-found marker when suggestions are empty after Enter shortcut', function (done) {
    LocationService.suggestions.and.returnValue($q.resolve([]));

    const { controller, elementScope } = compile(
      {
        locationQuery: 'zz',
      },
      '',
    );

    elementScope.skipSuggestions = true;

    controller.searchSuggestions('zz').then(function (result) {
      expect(result).toEqual([]);
      expect(elementScope.trLocationNotfound).toBe('zz');
      done();
    }, done.fail);

    $rootScope.$apply();
  });

  it('updates the linked center after a selection', function () {
    LocationService.getBounds.and.returnValue(false);
    LocationService.getCenter.and.returnValue({
      lat: 12.5,
      lng: 98.7,
    });

    const { controller, scope } = compile(
      {
        locationCenter: {},
      },
      'tr-location-center="locationCenter"',
    );

    controller.onSelect({}, null, 'Lisbon', {});
    $timeout.flush();

    expect(scope.locationQuery).toBe('Lisbon');
    expect(scope.locationCenter).toEqual({
      lat: 12.5,
      lng: 98.7,
    });
  });
});

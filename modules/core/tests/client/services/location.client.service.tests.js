import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/services/location.client.service';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';

describe('LocationService', function () {
  let $httpBackend;
  let LocationService;
  let appSettings;
  let $rootScope;

  beforeEach(function () {
    appSettings = {
      mapbox: {
        publicKey: 'test-public-key',
      },
      limits: {
        maxOfferValidFromNow: {
          days: 30,
        },
      },
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('SettingsFactory', {
        get() {
          return appSettings;
        },
      });
    });
  });

  beforeEach(inject(function (_$httpBackend_, _$rootScope_, _LocationService_) {
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    LocationService = _LocationService_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('uses the default location and parsed zoom', function () {
    expect(LocationService.getDefaultLocation('12')).toEqual({
      ...DEFAULT_LOCATION,
      zoom: 12,
    });
    expect(LocationService.getDefaultLocation()).toEqual(DEFAULT_LOCATION);
  });

  it('computes bounds from bbox coordinates', function () {
    expect(
      LocationService.getBounds({
        bbox: [24.9, 60.16, 24.98, 60.18],
      }),
    ).toEqual({
      northEast: {
        lat: 60.18,
        lng: 24.98,
      },
      southWest: {
        lat: 60.16,
        lng: 24.9,
      },
    });
  });

  it('derives bounds from center when bbox is unavailable', function () {
    const bounds = LocationService.getBounds({
      center: [24.94, 60.17],
    });

    expect(bounds.northEast.lat).toBeCloseTo(60.172, 3);
    expect(bounds.northEast.lng).toBeCloseTo(24.938, 3);
    expect(bounds.southWest.lat).toBeCloseTo(60.168, 3);
    expect(bounds.southWest.lng).toBeCloseTo(24.942, 3);
  });

  it('returns false for invalid bounds inputs', function () {
    expect(LocationService.getBounds()).toBe(false);
    expect(LocationService.getBounds({ bbox: [1, 2, 3] })).toBe(false);
    expect(LocationService.getBounds({ center: [1] })).toBe(false);
  });

  it('returns false for invalid centers', function () {
    expect(LocationService.getCenter({})).toBe(false);
    expect(LocationService.getCenter({ center: [1] })).toBe(false);
    expect(
      LocationService.getCenter({
        geometry: {
          coordinates: ['24.94', '60.17'],
        },
      }),
    ).toEqual({
      lng: 24.94,
      lat: 60.17,
    });
  });

  it('builds a short title from regular text and context', function () {
    expect(
      LocationService.shortTitle({
        text: 'Helsinki',
        context: [{ id: 'country.fi', text: 'Finland' }],
      }),
    ).toBe('Helsinki, Finland');
  });

  it('includes place context in short titles', function () {
    expect(
      LocationService.shortTitle({
        text: 'Kallio',
        context: [
          { id: 'place.123', text: 'Helsinki' },
          { id: 'country.fi', text: 'Finland' },
        ],
      }),
    ).toBe('Kallio, Helsinki, Finland');
  });

  it('uses place name when text is unavailable', function () {
    expect(
      LocationService.shortTitle({
        place_name: 'Somewhere, Earth',
      }),
    ).toBe('Somewhere, Earth');
  });

  it('keeps text-only and unknown-context titles unchanged', function () {
    expect(
      LocationService.shortTitle({
        text: 'Nowhere',
      }),
    ).toBe('Nowhere');
    expect(
      LocationService.shortTitle({
        text: 'Katajanokka',
        context: [{ id: 'region.123', text: 'Uusimaa' }],
      }),
    ).toBe('Katajanokka');
  });

  it('returns an empty title when no title fields are available', function () {
    expect(LocationService.shortTitle({})).toBe('');
  });

  it('uses place name for US context when available', function () {
    expect(
      LocationService.shortTitle({
        text: 'Portland',
        place_name: 'Portland, Oregon, United States',
        context: [
          { id: 'country.us', text: 'United States', short_code: 'us' },
        ],
      }),
    ).toBe('Portland, Oregon, United States');
  });

  it('returns an empty list if no Mapbox key is configured', function (done) {
    appSettings.mapbox = {};

    LocationService.suggestions('Helsinki').then(function (suggestions) {
      expect(suggestions).toEqual([]);
      done();
    }, done.fail);
  });

  it('returns an empty list for short or empty queries', function (done) {
    LocationService.suggestions('h')
      .then(function (suggestions) {
        expect(suggestions).toEqual([]);
        return LocationService.suggestions('');
      }, done.fail)
      .then(function (suggestions) {
        expect(suggestions).toEqual([]);
        done();
      }, done.fail);
  });

  it('queries Mapbox and annotates short titles', function (done) {
    $httpBackend
      .expectGET(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/Helsinki.json?access_token=test-public-key&language=en&types=place',
      )
      .respond(200, {
        features: [
          {
            text: 'Helsinki',
            context: [{ id: 'country.fi', text: 'Finland' }],
          },
        ],
      });

    LocationService.suggestions('Helsinki', 'place').then(function (
      suggestions,
    ) {
      expect(suggestions).toEqual([
        jasmine.objectContaining({
          trTitle: 'Helsinki, Finland',
        }),
      ]);
      done();
    },
    done.fail);

    $httpBackend.flush();
  });

  it('returns empty list for mapbox responses without features', function (done) {
    $httpBackend
      .expectGET(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/Helsinki.json?access_token=test-public-key&language=en',
      )
      .respond(200, {});

    LocationService.suggestions('Helsinki').then(function (suggestions) {
      expect(suggestions).toEqual([]);
      done();
    }, done.fail);

    $httpBackend.flush();
    $rootScope.$apply();
  });

  it('returns empty list for failed mapbox responses', function (done) {
    $httpBackend
      .expectGET(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/Helsinki.json?access_token=test-public-key&language=en',
      )
      .respond(503, {});

    LocationService.suggestions('Helsinki').then(function (suggestions) {
      expect(suggestions).toEqual([]);
      done();
    }, done.fail);

    $httpBackend.flush();
    $rootScope.$apply();
  });
});

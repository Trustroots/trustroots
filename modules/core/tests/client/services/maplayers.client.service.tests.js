import AppConfig from '@/modules/core/client/app/config';

describe('MapLayersFactory', function () {
  let $injector;
  let SettingsFactory;
  let LocationService;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(function () {
    SettingsFactory = {
      get: jasmine.createSpy('SettingsFactory.get'),
    };

    LocationService = {
      getDefaultLocation: jasmine
        .createSpy('LocationService.getDefaultLocation')
        .and.returnValue({
          lat: 12.5,
          lng: 18.25,
          zoom: 11,
        }),
    };

    angular.mock.module(function ($provide) {
      $provide.value('SettingsFactory', SettingsFactory);
      $provide.value('LocationService', LocationService);
    });
  });

  beforeEach(inject(function (_$injector_) {
    $injector = _$injector_;
  }));

  function createFactory(settings) {
    SettingsFactory.get.and.returnValue(settings);
    return $injector.get('MapLayersFactory');
  }

  it('uses mapbox layers for streets when fully configured', function () {
    const factory = createFactory({
      mapbox: {
        user: 'trustroots',
        publicKey: 'pk.test',
        maps: {
          streets: {
            map: 'st.123456',
          },
        },
      },
    });

    const layers = factory.getLayers();

    expect(layers.streets.name).toBe('Streets');
    expect(layers.streets.type).toBe('xyz');
    expect(layers.streets.url).toContain('api.mapbox.com/styles/v1');
    expect(layers.streets.layerParams.user).toBe('trustroots');
    expect(layers.streets.layerParams.token).toBe('pk.test');
    expect(layers.streets.layerParams.map).toBe('st.123456');
  });

  it('falls back to openstreetmap streets when mapbox is unavailable', function () {
    const factory = createFactory({
      mapbox: {
        user: false,
        publicKey: false,
      },
    });

    const layers = factory.getLayers({ streets: true });

    expect(layers.streets.name).toBe('Streets');
    expect(layers.streets.url).toBe(
      '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(layers.streets.layerOptions.attribution).toContain(
      'Improve the underlying map',
    );
  });

  it('falls back to NASA earth data for satellite when configured mapbox layer is unavailable', function () {
    const factory = createFactory({
      mapbox: {
        user: false,
        publicKey: false,
      },
    });

    const layers = factory.getLayers({ streets: false, satellite: true });

    expect(layers.satellite.name).toBe('Satellite');
    expect(layers.satellite.url).toContain('gibs-');
    expect(layers.satellite.layerOptions.layer).toBe(
      'Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual',
    );
  });

  it('uses mapbox satellite layers when requested and configured', function () {
    const factory = createFactory({
      mapbox: {
        user: 'trustroots',
        publicKey: 'pk.test',
        maps: {
          satellite: {
            map: 'satellite-v9',
          },
        },
      },
    });

    const layers = factory.getLayers({ streets: false, satellite: true });

    expect(layers.satellite.name).toBe('Satellite');
    expect(layers.satellite.url).toContain('api.mapbox.com/styles/v1');
    expect(layers.satellite.layerParams.map).toBe('satellite-v9');
    expect(layers.satellite.layerOptions.attribution).toContain(
      'mapbox.satellite',
    );
  });

  it('uses legacy mapbox layer URL format when legacy config is provided', function () {
    const factory = createFactory({
      mapbox: {
        user: 'trustroots',
        publicKey: 'pk.test',
        maps: {
          streets: {
            map: 'st.123456',
            legacy: true,
          },
        },
      },
    });

    const layers = factory.getLayers({ streets: true });

    expect(layers.streets.url).toContain('tiles.mapbox.com/v4');
    expect(layers.streets.url).toContain('secure=1');
    expect(layers.streets.layerParams.map).toBe('st.123456');
    expect(layers.streets.layerOptions.attribution).toContain('map-feedback');
  });

  it('adds outdoors mapbox layer when requested and configured', function () {
    const factory = createFactory({
      mapbox: {
        user: 'trustroots',
        publicKey: 'pk.test',
        maps: {
          streets: {
            map: 'st.123456',
          },
          outdoors: {
            map: 'outdoors.98765',
          },
        },
      },
    });

    const layers = factory.getLayers({ outdoors: true, streets: false });

    expect(layers.outdoors.name).toBe('Outdoors');
    expect(layers.outdoors.url).toContain('api.mapbox.com/styles/v1');
    expect(layers.outdoors.layerParams.map).toBe('outdoors.98765');
  });

  it('omits outdoors layer when requested but not configured', function () {
    const factory = createFactory({
      mapbox: {
        user: 'trustroots',
        publicKey: 'pk.test',
        maps: {
          streets: {
            map: 'st.123456',
          },
        },
      },
    });

    const layers = factory.getLayers({ outdoors: true, streets: false });

    expect(layers.outdoors).toBeUndefined();
  });

  it('returns no layers when all options are disabled', function () {
    const factory = createFactory({
      mapbox: {
        user: false,
        publicKey: false,
      },
    });

    const layers = factory.getLayers({
      streets: false,
      satellite: false,
      outdoors: false,
    });

    expect(layers).toEqual({});
  });

  it('falls back when mapbox settings are missing entirely', function () {
    const factory = createFactory({});

    const layers = factory.getLayers();

    expect(layers.streets.name).toBe('Streets');
    expect(layers.streets.url).toContain('openstreetmap.org');
  });
});

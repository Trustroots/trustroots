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
});

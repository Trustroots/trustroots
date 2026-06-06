describe('Map constants', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/modules/core/client/utils/map');
  });

  it('uses OpenStreetMap style when there is no Mapbox token', () => {
    jest.doMock('@/modules/core/client/utils/map', () => ({
      getMapBoxToken: () => '',
    }));

    jest.isolateModules(() => {
      const {
        MAP_STYLE_DEFAULT,
        MAP_STYLE_OSM,
      } = require('@/modules/core/client/components/Map/constants');

      expect(MAP_STYLE_DEFAULT).toBe(MAP_STYLE_OSM);
    });
  });

  it('uses Mapbox streets style when there is a Mapbox token', () => {
    jest.doMock('@/modules/core/client/utils/map', () => ({
      getMapBoxToken: () => 'token',
    }));

    jest.isolateModules(() => {
      const {
        MAP_STYLE_DEFAULT,
        MAP_STYLE_MAPBOX_STREETS,
      } = require('@/modules/core/client/components/Map/constants');

      expect(MAP_STYLE_DEFAULT).toBe(MAP_STYLE_MAPBOX_STREETS);
    });
  });
});

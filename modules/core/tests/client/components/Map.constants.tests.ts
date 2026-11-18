describe('Map constants', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/modules/core/client/utils/map');
  });

  it('uses OpenStreetMap style when there is no Mapbox token', async () => {
    vi.doMock('@/modules/core/client/utils/map', () => ({
      getMapBoxToken: () => '',
    }));

    const { MAP_STYLE_DEFAULT, MAP_STYLE_OSM } =
      await import('@/modules/core/client/components/Map/constants');

    expect(MAP_STYLE_DEFAULT).toBe(MAP_STYLE_OSM);
  });

  it('uses Mapbox streets style when there is a Mapbox token', async () => {
    vi.doMock('@/modules/core/client/utils/map', () => ({
      getMapBoxToken: () => 'token',
    }));

    const { MAP_STYLE_DEFAULT, MAP_STYLE_MAPBOX_STREETS } =
      await import('@/modules/core/client/components/Map/constants');

    expect(MAP_STYLE_DEFAULT).toBe(MAP_STYLE_MAPBOX_STREETS);
  });
});

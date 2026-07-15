import {
  getRasterMapTiles,
  isWebGLSupported,
} from '@/modules/core/client/utils/map';

describe('map utilities', () => {
  let createElement;

  beforeEach(() => {
    createElement = jest.spyOn(document, 'createElement');
  });

  afterEach(() => {
    createElement.mockRestore();
  });

  it('detects an available WebGL context', () => {
    const getContext = jest.fn(type => (type === 'webgl' ? {} : null));
    createElement.mockReturnValue({ getContext });

    expect(isWebGLSupported()).toBe(true);
    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(getContext).toHaveBeenCalledWith('webgl');
  });

  it('uses the legacy WebGL context when necessary', () => {
    const getContext = jest.fn(type =>
      type === 'experimental-webgl' ? {} : null,
    );
    createElement.mockReturnValue({ getContext });

    expect(isWebGLSupported()).toBe(true);
    expect(getContext).toHaveBeenNthCalledWith(1, 'webgl');
    expect(getContext).toHaveBeenNthCalledWith(2, 'experimental-webgl');
  });

  it('returns false when the browser blocks WebGL', () => {
    createElement.mockReturnValue({ getContext: () => null });

    expect(isWebGLSupported()).toBe(false);
  });

  it('uses Mapbox Streets raster tiles when a public token is configured', () => {
    expect(getRasterMapTiles('mapbox-public-token')).toEqual({
      options: expect.objectContaining({
        accessToken: 'mapbox-public-token',
        maxZoom: 19,
      }),
      url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/{z}/{x}/{y}?access_token={accessToken}',
    });
  });

  it('falls back to OpenStreetMap raster tiles without a Mapbox token', () => {
    expect(getRasterMapTiles(null)).toEqual({
      options: expect.objectContaining({ maxZoom: 19 }),
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    });
  });

  it('returns false outside a browser', () => {
    expect(isWebGLSupported(null)).toBe(false);
  });

  it('returns false when the browser throws while creating WebGL', () => {
    createElement.mockImplementation(() => {
      throw new Error('WebGL blocked');
    });

    expect(isWebGLSupported()).toBe(false);
  });
});

import { invokeMalformed } from '@/testutils/client/malformed-fixtures';
import {
  addRasterMapTiles,
  getRasterMapTiles,
  isWebGLSupported,
} from '@/modules/core/client/utils/map';

const createCanvas = document.createElement.bind(document);

// Preserve the minimal WebGL doubles; only getContext is used by this helper.
function canvasElement(
  getContext: (type: string) => object | null,
): HTMLCanvasElement {
  const canvas = createCanvas('canvas');
  Object.defineProperty(canvas, 'getContext', { value: getContext });
  return canvas;
}

describe('map utilities', () => {
  let createElement: jest.SpyInstance<
    HTMLElement,
    Parameters<Document['createElement']>
  >;

  beforeEach(() => {
    createElement = jest.spyOn(document, 'createElement');
  });

  afterEach(() => {
    createElement.mockRestore();
  });

  it('detects an available WebGL context', () => {
    const getContext = jest.fn((type: string) =>
      type === 'webgl2' ? {} : null,
    );
    createElement.mockReturnValue(canvasElement(getContext));

    expect(isWebGLSupported()).toBe(true);
    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(getContext).toHaveBeenCalledWith('webgl2');
  });

  it('uses raster rendering when only WebGL1 is available', () => {
    const getContext = jest.fn(type =>
      type === 'webgl' || type === 'experimental-webgl' ? {} : null,
    );
    createElement.mockReturnValue(canvasElement(getContext));

    expect(isWebGLSupported()).toBe(false);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('returns false when the browser blocks WebGL', () => {
    createElement.mockReturnValue(canvasElement(() => null));

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
    expect(getRasterMapTiles().url).toContain('openstreetmap.org');
    expect(
      // Preserve the original null token beyond the public optional-token type.
      invokeMalformed(getRasterMapTiles, null),
    ).toEqual({
      options: expect.objectContaining({ maxZoom: 19 }),
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    });
  });

  it('replaces a failed Mapbox raster layer with OpenStreetMap once', () => {
    const map = {};
    const mapboxLayer = {
      addTo: jest.fn(),
      once: jest.fn((event: string, handler: () => void) => {
        expect(event).toBe('tileerror');
        expect(handler).toEqual(expect.any(Function));
      }),
      remove: jest.fn(),
    };
    const osmLayer = { addTo: jest.fn() };
    const tileLayer = jest
      .fn()
      .mockReturnValueOnce(mapboxLayer)
      .mockReturnValueOnce(osmLayer);

    expect(
      addRasterMapTiles({ map, mapboxToken: 'public-token', tileLayer }),
    ).toBe(mapboxLayer);
    expect(mapboxLayer.addTo).toHaveBeenCalledWith(map);

    const tileError = mapboxLayer.once.mock.calls[0][1];
    tileError();
    tileError();

    expect(mapboxLayer.remove).toHaveBeenCalledTimes(1);
    expect(tileLayer).toHaveBeenNthCalledWith(
      2,
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ maxZoom: 19 }),
    );
    expect(osmLayer.addTo).toHaveBeenCalledTimes(1);
    expect(osmLayer.addTo).toHaveBeenCalledWith(map);
  });

  it('adds OpenStreetMap directly without a Mapbox token', () => {
    const map = {};
    const layer = { addTo: jest.fn(), once: jest.fn(), remove: jest.fn() };
    const tileLayer = jest.fn(() => layer);

    addRasterMapTiles({ map, mapboxToken: false, tileLayer });

    expect(layer.once).not.toHaveBeenCalled();
    expect(layer.addTo).toHaveBeenCalledWith(map);
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

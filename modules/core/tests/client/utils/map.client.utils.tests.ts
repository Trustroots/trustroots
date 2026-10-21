import { invokeMalformed } from '@/testutils/client/malformed-fixtures';
import {
  getRasterMapTiles,
  isChromiumBrowser,
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
  it.each([
    ['Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36', true],
    ['Mozilla/5.0 Chromium/140.0.0.0', true],
    ['Mozilla/5.0 HeadlessChrome/140.0.0.0 Safari/537.36', true],
    ['Mozilla/5.0 Chrome/140.0.0.0 Edg/140.0.0.0', true],
    ['Mozilla/5.0 OPR/120.0.0.0', true],
    ['Mozilla/5.0 Firefox/143.0', false],
    ['Mozilla/5.0 Version/18.0 Safari/605.1.15', false],
    ['Mozilla/5.0 CriOS/140.0.0.0 Mobile Safari/604.1', false],
    ['', false],
  ])('recognises the Chromium engine in %s', (userAgent, expected) => {
    // Brave uses the same Chrome user agent as other Chromium browsers.
    expect(isChromiumBrowser(userAgent)).toBe(expected);
  });

  it('uses the current browser user agent by default', () => {
    const userAgent = jest.spyOn(navigator, 'userAgent', 'get');
    userAgent.mockReturnValue('Mozilla/5.0 Chrome/140.0.0.0');
    expect(isChromiumBrowser()).toBe(true);
    userAgent.mockRestore();
  });
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
      type === 'webgl' ? {} : null,
    );
    createElement.mockReturnValue(canvasElement(getContext));

    expect(isWebGLSupported()).toBe(true);
    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(getContext).toHaveBeenCalledWith('webgl');
  });

  it('uses the legacy WebGL context when necessary', () => {
    const getContext = jest.fn(type =>
      type === 'experimental-webgl' ? {} : null,
    );
    createElement.mockReturnValue(canvasElement(getContext));

    expect(isWebGLSupported()).toBe(true);
    expect(getContext).toHaveBeenNthCalledWith(1, 'webgl');
    expect(getContext).toHaveBeenNthCalledWith(2, 'experimental-webgl');
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
    expect(
      // Preserve the original null token beyond the public optional-token type.
      invokeMalformed(getRasterMapTiles, null),
    ).toEqual({
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

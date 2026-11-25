import type { MockInstance } from 'vitest';
import {
  distanceInMetres,
  getMapBoxToken,
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
  it('measures great-circle distances in metres', () => {
    expect(distanceInMetres([52.52, 13.405], [52.52, 13.405])).toBe(0);
    expect(
      Math.round(distanceInMetres([52.52, 13.405], [48.8566, 2.3522])),
    ).toBe(877463);
  });

  let createElement: MockInstance<
    (...args: Parameters<Document['createElement']>) => HTMLElement
  >;

  beforeEach(() => {
    createElement = vi.spyOn(document, 'createElement');
  });

  afterEach(() => {
    createElement.mockRestore();
  });

  it('detects an available WebGL context', () => {
    const getContext = vi.fn((type: string) => (type === 'webgl2' ? {} : null));
    createElement.mockReturnValue(canvasElement(getContext));

    expect(isWebGLSupported()).toBe(true);
    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(getContext).toHaveBeenCalledWith('webgl2');
  });

  it('does not accept WebGL1 alone', () => {
    const getContext = vi.fn(type =>
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

  it('reads the public Mapbox geocoding token from the page settings', () => {
    Reflect.set(window, 'settings', { mapbox: { publicKey: 'public-token' } });
    expect(getMapBoxToken()).toBe('public-token');
    Reflect.set(window, 'settings', {});
    expect(getMapBoxToken()).toBeUndefined();
    Reflect.deleteProperty(window, 'settings');
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

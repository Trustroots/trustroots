import type { MockInstance } from 'vitest';
import { ready } from '@/modules/core/client/utils/dom';

type DetectWebP = typeof import('@/modules/core/client/utils/dom').canUseWebP;
type ImageProbe = {
  naturalWidth: number;
  naturalHeight: number;
  src: string;
  onload: ((event: Event) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
};

function withReadyState(state: DocumentReadyState, fn: () => void): void {
  const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
    document,
    'readyState',
  );
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: state,
    writable: true,
  });

  try {
    return fn();
  } finally {
    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor,
      );
    }
  }
}

describe('ready', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls callback immediately when document is ready', () => {
    const cb = vi.fn();
    withReadyState('complete', () => {
      const addEventListener = vi.spyOn(document, 'addEventListener');
      ready(cb);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(addEventListener).not.toHaveBeenCalled();
    });
  });

  it('registers callback for DOMContentLoaded while loading', () => {
    const cb = vi.fn();
    withReadyState('loading', () => {
      const addEventListener = vi.spyOn(document, 'addEventListener');
      ready(cb);
      expect(cb).not.toHaveBeenCalled();
      expect(addEventListener).toHaveBeenCalledWith(
        'DOMContentLoaded',
        cb,
        false,
      );
    });
  });

  it('noops when callback is not a function', () => {
    expect(ready()).toBeUndefined();
  });
});

describe('canUseWebP', () => {
  let detectWebP: DetectWebP;
  let image: ImageProbe;
  let imageConstructor: MockInstance<
    (...args: ConstructorParameters<typeof Image>) => HTMLImageElement
  >;

  beforeEach(async () => {
    vi.resetModules();
    detectWebP = (await import('@/modules/core/client/utils/dom')).canUseWebP;
    image = {
      naturalWidth: 0,
      naturalHeight: 0,
      src: '',
      onload: null,
      onerror: null,
    };
    imageConstructor = vi
      .spyOn(window, 'Image')
      // This deliberately implements only the image fields the probe reads.
      .mockImplementation(function () {
        return image as HTMLImageElement;
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses JPEG while decoding a single cached image probe without canvas access', () => {
    const createElement = vi.spyOn(document, 'createElement');
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');

    expect(detectWebP()).toBe(false);
    expect(detectWebP()).toBe(false);
    expect(imageConstructor).toHaveBeenCalledTimes(1);
    expect(image.src).toMatch(/^data:image\/webp;base64,/);
    expect(createElement).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it('caches support after the WebP image decodes successfully', () => {
    detectWebP();
    image.naturalWidth = 1;
    image.naturalHeight = 1;
    image.onload?.(new Event('load'));

    expect(detectWebP()).toBe(true);
    expect(detectWebP()).toBe(true);
    expect(imageConstructor).toHaveBeenCalledTimes(1);
  });

  it('keeps JPEG when the image cannot be decoded or is blocked', () => {
    detectWebP();
    image.onerror?.(new Event('error'));

    expect(detectWebP()).toBe(false);
    expect(imageConstructor).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, 1],
    [1, 0],
  ])('rejects a decoded probe with dimensions %s by %s', (width, height) => {
    detectWebP();
    image.naturalWidth = width;
    image.naturalHeight = height;
    image.onload?.(new Event('load'));

    expect(detectWebP()).toBe(false);
  });
});

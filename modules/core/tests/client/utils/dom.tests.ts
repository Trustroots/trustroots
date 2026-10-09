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
    jest.restoreAllMocks();
  });

  it('calls callback immediately when document is ready', () => {
    const cb = jest.fn();
    withReadyState('complete', () => {
      const addEventListener = jest.spyOn(document, 'addEventListener');
      ready(cb);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(addEventListener).not.toHaveBeenCalled();
    });
  });

  it('registers callback for DOMContentLoaded while loading', () => {
    const cb = jest.fn();
    withReadyState('loading', () => {
      const addEventListener = jest.spyOn(document, 'addEventListener');
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
  let imageConstructor: jest.SpyInstance<
    HTMLImageElement,
    ConstructorParameters<typeof Image>
  >;

  beforeEach(() => {
    jest.isolateModules(() => {
      detectWebP = jest.requireActual<
        typeof import('@/modules/core/client/utils/dom')
      >('@/modules/core/client/utils/dom').canUseWebP;
    });
    image = {
      naturalWidth: 0,
      naturalHeight: 0,
      src: '',
      onload: null,
      onerror: null,
    };
    imageConstructor = jest
      .spyOn(window, 'Image')
      // This deliberately implements only the image fields the probe reads.
      .mockImplementation(() => image as HTMLImageElement);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses JPEG while decoding a single cached image probe without canvas access', () => {
    const createElement = jest.spyOn(document, 'createElement');
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const toDataURL = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL');

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

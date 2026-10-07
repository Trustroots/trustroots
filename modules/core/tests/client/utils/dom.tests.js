import { ready } from '@/modules/core/client/utils/dom';

function withReadyState(state, fn) {
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
  let detectWebP;
  let image;
  let imageConstructor;

  beforeEach(() => {
    jest.isolateModules(() => {
      detectWebP = require('@/modules/core/client/utils/dom').canUseWebP;
    });
    image = { naturalWidth: 0, naturalHeight: 0 };
    imageConstructor = jest
      .spyOn(window, 'Image')
      .mockImplementation(() => image);
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
    image.onload();

    expect(detectWebP()).toBe(true);
    expect(detectWebP()).toBe(true);
    expect(imageConstructor).toHaveBeenCalledTimes(1);
  });

  it('keeps JPEG when the image cannot be decoded or is blocked', () => {
    detectWebP();
    image.onerror();

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
    image.onload();

    expect(detectWebP()).toBe(false);
  });
});

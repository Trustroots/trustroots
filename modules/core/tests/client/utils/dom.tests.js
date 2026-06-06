import { canUseWebP, ready } from '@/modules/core/client/utils/dom';

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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false when window is unavailable', () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
      global,
      'window',
    );
    const originalWindow = global.window;

    Object.defineProperty(global, 'window', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(canUseWebP()).toBe(false);
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(global, 'window', originalWindowDescriptor);
      } else {
        Object.defineProperty(global, 'window', {
          configurable: true,
          value: originalWindow,
          writable: true,
        });
      }
    }
  });

  it('returns false when canvas context is unavailable', () => {
    const createElement = jest
      .spyOn(document, 'createElement')
      .mockReturnValue({
        getContext: jest.fn(() => null),
      });

    expect(canUseWebP()).toBe(false);
    expect(createElement).toHaveBeenCalledWith('canvas');
  });

  it('returns true when browser reports webp support', () => {
    const createElement = jest
      .spyOn(document, 'createElement')
      .mockReturnValue({
        getContext: jest.fn(() => ({})),
        toDataURL: jest.fn(() => 'data:image/webp;base64,foobar'),
      });

    expect(canUseWebP()).toBe(true);
    expect(createElement).toHaveBeenCalledWith('canvas');
  });
});

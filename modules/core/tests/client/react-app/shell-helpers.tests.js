import {
  defaultNavigate,
  signout,
} from '@/modules/core/client/react-app/shell-helpers';

describe('React shell helpers', () => {
  it('uses the default navigate helper', () => {
    const assign = jest.fn();
    const locationSpy = jest
      .spyOn(window, 'location', 'get')
      .mockReturnValue({ ...window.location, assign });

    try {
      defaultNavigate('/signin');
      expect(assign).toHaveBeenCalledWith('/signin');
    } finally {
      locationSpy.mockRestore();
    }
  });

  it('signs out without browser postMessage support', () => {
    const originalPostMessage = window.postMessage;
    const originalTop = window.top;
    let topHref = 'http://localhost/rules';

    window.postMessage = undefined;
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: {
        location: {
          get href() {
            return topHref;
          },
          set href(value) {
            topHref = value;
          },
        },
      },
    });

    try {
      signout();
      expect(topHref).toBe('/api/auth/signout');
    } finally {
      window.postMessage = originalPostMessage;
      Object.defineProperty(window, 'top', {
        configurable: true,
        value: originalTop,
      });
    }
  });

  it('prevents default when sign out receives an event', () => {
    const preventDefault = jest.fn();
    const originalTop = window.top;
    let topHref = 'http://localhost/rules';

    Object.defineProperty(window, 'top', {
      configurable: true,
      value: {
        location: {
          get href() {
            return topHref;
          },
          set href(value) {
            topHref = value;
          },
        },
      },
    });

    try {
      signout({ preventDefault });
      expect(preventDefault).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'top', {
        configurable: true,
        value: originalTop,
      });
    }
  });

  it('posts native mobile sign out messages', () => {
    const postMessage = jest.fn();
    const originalPostMessage = window.postMessage;
    const originalTop = window.top;
    const originalIsNativeMobileApp = window.isNativeMobileApp;
    let topHref = 'http://localhost/rules';

    window.postMessage = postMessage;
    window.isNativeMobileApp = true;
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: {
        location: {
          get href() {
            return topHref;
          },
          set href(value) {
            topHref = value;
          },
        },
      },
    });

    try {
      signout({ preventDefault: jest.fn() });

      expect(postMessage).toHaveBeenCalledWith(
        JSON.stringify({ action: 'unAuthenticated' }),
      );
      expect(topHref).toBe('/api/auth/signout');
    } finally {
      window.postMessage = originalPostMessage;
      window.isNativeMobileApp = originalIsNativeMobileApp;
      Object.defineProperty(window, 'top', {
        configurable: true,
        value: originalTop,
      });
    }
  });
});

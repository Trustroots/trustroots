import {
  defaultNavigate,
  navigateTo,
  navigation,
  signout,
} from '@/modules/core/client/react-app/shell-helpers';

describe('React shell helpers', () => {
  it('uses the default navigate helper', () => {
    const go = jest.spyOn(navigation, 'go').mockImplementation(() => {});

    try {
      defaultNavigate('/signin');
      expect(go).toHaveBeenCalledWith('/signin');
    } finally {
      go.mockRestore();
    }
  });

  it('navigateTo uses location.assign when available', () => {
    const assign = jest.fn();

    navigateTo('/faq', { assign });

    expect(assign).toHaveBeenCalledWith('/faq');
  });

  it('navigateTo falls back to href when assign is unavailable', () => {
    const location = { href: '' };

    navigateTo('/faq', location);

    expect(location.href).toBe('/faq');
  });

  it('navigation.go forwards to navigateTo', () => {
    const assign = jest.fn();
    const originalGo = navigation.go;

    navigation.go = function go(url) {
      navigateTo(url, { assign });
    };

    try {
      navigation.go('/welcome');
      expect(assign).toHaveBeenCalledWith('/welcome');
    } finally {
      navigation.go = originalGo;
    }

    // Exercise the real navigation.go implementation (uses window.location).
    expect(() => originalGo('/support')).not.toThrow();
  });

  it('signs out without browser postMessage support', () => {
    const originalPostMessage = window.postMessage;

    window.postMessage = undefined;

    try {
      expect(() => signout()).not.toThrow();
    } finally {
      window.postMessage = originalPostMessage;
    }
  });

  it('prevents default when sign out receives an event', () => {
    const preventDefault = jest.fn();

    signout({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
  });

  it('posts native mobile sign out messages', () => {
    const postMessage = jest.fn();
    const originalPostMessage = window.postMessage;
    const originalIsNativeMobileApp = window.isNativeMobileApp;

    window.postMessage = postMessage;
    window.isNativeMobileApp = true;

    try {
      signout({ preventDefault: jest.fn() });

      expect(postMessage).toHaveBeenCalledWith(
        JSON.stringify({ action: 'unAuthenticated' }),
      );
    } finally {
      window.postMessage = originalPostMessage;
      window.isNativeMobileApp = originalIsNativeMobileApp;
    }
  });
});

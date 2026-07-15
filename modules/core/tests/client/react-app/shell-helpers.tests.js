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

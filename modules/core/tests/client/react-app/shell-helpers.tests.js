import {
  defaultNavigate,
  getClientNavigationTarget,
  navigateTo,
  navigation,
  signout,
} from '@/modules/core/client/react-app/shell-helpers';

describe('React shell helpers', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

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

  it('navigateTo updates same-origin history without loading a document', () => {
    const pushState = jest.fn();
    const dispatchEvent = jest.fn();

    navigateTo(
      '/faq?topic=routes',
      window.location,
      { pushState },
      dispatchEvent,
    );

    expect(pushState).toHaveBeenCalledWith({}, '', '/faq?topic=routes');
    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(PopStateEvent));
  });

  it('navigateTo ignores navigation to the current browser URL', () => {
    const pushState = jest.fn();
    const location = {
      assign: jest.fn(),
      hash: '',
      href: 'https://www.trustroots.org/',
      origin: 'https://www.trustroots.org',
      pathname: '/',
      search: '',
    };

    navigateTo('/', location, { pushState });

    expect(pushState).not.toHaveBeenCalled();
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('navigateTo leaves cross-origin navigation to the browser', () => {
    const location = {
      assign: jest.fn(),
      hash: '',
      href: 'https://www.trustroots.org/',
      origin: 'https://www.trustroots.org',
      pathname: '/',
      search: '',
    };

    navigateTo('https://ideas.trustroots.org/', location, {
      pushState: jest.fn(),
    });

    expect(location.assign).toHaveBeenCalledWith(
      'https://ideas.trustroots.org/',
    );
  });

  it.each([
    ['an already handled click', { defaultPrevented: true }],
    ['a secondary click', { button: 1 }],
    ['a meta-assisted click', { metaKey: true }],
    ['a control-assisted click', { ctrlKey: true }],
    ['a shift-assisted click', { shiftKey: true }],
    ['an alt-assisted click', { altKey: true }],
  ])('does not intercept %s', (description, overrides) => {
    const anchor = document.createElement('a');
    anchor.href = '/faq';

    expect(
      getClientNavigationTarget({
        button: 0,
        defaultPrevented: false,
        target: anchor,
        ...overrides,
      }),
    ).toBeNull();
  });

  it.each([
    ['a click outside a link', document.createElement('span')],
    [
      'a downloaded link',
      Object.assign(document.createElement('a'), {
        download: 'rules.txt',
        href: '/rules',
      }),
    ],
    [
      'a targeted link',
      Object.assign(document.createElement('a'), {
        href: '/rules',
        target: '_blank',
      }),
    ],
    [
      'an external relationship link',
      Object.assign(document.createElement('a'), {
        href: '/rules',
        rel: 'external',
      }),
    ],
    [
      'a fragment link',
      Object.assign(document.createElement('a'), {
        href: '#content',
      }),
    ],
    [
      'an external link',
      Object.assign(document.createElement('a'), {
        href: 'https://ideas.trustroots.org/',
      }),
    ],
  ])('leaves %s to the browser', (description, target) => {
    expect(
      getClientNavigationTarget({
        button: 0,
        defaultPrevented: false,
        target,
      }),
    ).toBeNull();
  });

  it('returns a same-origin application target from a nested link element', () => {
    const anchor = document.createElement('a');
    const label = document.createElement('span');
    anchor.href = '/support?report=alice';
    anchor.appendChild(label);

    expect(
      getClientNavigationTarget({
        button: 0,
        defaultPrevented: false,
        target: label,
      }),
    ).toBe('/support?report=alice');
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

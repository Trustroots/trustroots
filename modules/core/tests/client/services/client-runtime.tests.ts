import {
  broadcastClientEvent,
  getCurrentRouteParams,
  getCurrentUser,
  navigate,
  onClientEvent,
  resolveNavigationTarget,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';

type NavigationLocationMock = Pick<Partial<Location>, 'assign' | 'href'>;

function asNavigationLocation(location: NavigationLocationMock): Location {
  // These tests intentionally provide only the browser fields navigation uses.
  return location as unknown as Location;
}

describe('client runtime helpers', () => {
  afterEach(() => {
    delete window.ga;
    delete window.user;
    window.history.pushState({}, '', '/');
  });

  it('broadcasts and receives browser events with arguments', () => {
    const listener = jest.fn<void, [error: null, ...args: unknown[]]>();
    const unsubscribe = onClientEvent('userUpdated', listener);

    broadcastClientEvent('userUpdated', { _id: 'user-1' });

    expect(listener).toHaveBeenCalledWith(null, { _id: 'user-1' });
    unsubscribe();
  });

  it('reads route and query parameters from the current location', () => {
    window.history.pushState({}, '', '/messages/alice?userId=123');

    expect(getCurrentRouteParams()).toEqual({
      userId: '123',
      username: 'alice',
    });
  });

  it('resolves named, direct, circle, and message navigation targets', () => {
    expect(resolveNavigationTarget('inbox')).toBe('/messages');
    expect(resolveNavigationTarget('/support', { report: 'alice' })).toBe(
      '/support?report=alice',
    );
    expect(
      resolveNavigationTarget('circles.circle', { circle: 'cyclists' }),
    ).toBe('/circles/cyclists');
    expect(
      resolveNavigationTarget('messageThread', {
        username: 'alice',
        userId: '123',
      }),
    ).toBe('/messages/alice?username=alice&userId=123');
    expect(resolveNavigationTarget('unknown-state')).toBeNull();
  });

  it('navigates through the browser location', () => {
    const location = { assign: jest.fn<void, [url: string]>() };

    navigate(
      'signup',
      { tribe: 'nomads' },
      undefined,
      asNavigationLocation(location),
    );

    expect(location.assign).toHaveBeenCalledWith('/signup?tribe=nomads');
  });

  it('uses href when the location has no assign method', () => {
    const location: NavigationLocationMock = {};

    navigate(
      '/support',
      { report: 'alice' },
      undefined,
      asNavigationLocation(location),
    );

    expect(location.href).toBe('/support?report=alice');
  });

  it('can force a full-page navigation', () => {
    const location = { assign: jest.fn<void, [url: string]>() };

    navigate(
      '/messages',
      undefined,
      { reload: true },
      asNavigationLocation(location),
    );

    expect(location.assign).toHaveBeenCalledWith('/messages');
  });

  it('does nothing for an unknown navigation target', () => {
    const location = { assign: jest.fn<void, [url: string]>() };

    expect(
      navigate('unknown-state', {}, undefined, asNavigationLocation(location)),
    ).toBeUndefined();
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('ignores null and undefined query values', () => {
    expect(
      resolveNavigationTarget('/support', { one: null, two: undefined }),
    ).toBe('/support');
  });

  it('returns no route parameters for an unmatched path', () => {
    expect(
      getCurrentRouteParams({ pathname: '/not-a-route', search: '' } as Pick<
        Location,
        'pathname' | 'search'
      > as Location),
    ).toEqual({});
  });

  it('broadcasts events without arguments and tracks safely without analytics', () => {
    const listener = jest.fn<void, [error: null, ...args: unknown[]]>();
    const unsubscribe = onClientEvent('empty', listener);

    broadcastClientEvent('empty');
    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();

    expect(trackEvent('no-analytics')).toBeUndefined();
  });

  it('handles events without a detail payload and uses default analytics category', () => {
    const listener = jest.fn<void, [error: null, ...args: unknown[]]>();
    const unsubscribe = onClientEvent('bare', listener);
    window.dispatchEvent(new Event('tr:bare'));
    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();

    window.ga = jest.fn();
    trackEvent('bare-action', { label: 'bare' });
    expect(window.ga).toHaveBeenCalledWith(
      'send',
      'event',
      'default',
      'bare-action',
      'bare',
    );
  });

  it('tracks analytics through window.ga when available', () => {
    window.ga = jest.fn();

    trackEvent('join', { category: 'test', label: 'label' });

    expect(window.ga).toHaveBeenCalledWith(
      'send',
      'event',
      'test',
      'join',
      'label',
    );
  });

  it('returns the current browser user or null', () => {
    expect(getCurrentUser()).toBeNull();

    window.user = { _id: 'user-1' };
    expect(getCurrentUser()).toEqual({ _id: 'user-1' });
  });
});

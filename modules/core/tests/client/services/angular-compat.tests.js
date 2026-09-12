import {
  $broadcast,
  $on,
  eventTrack,
  getRouteParams,
  go,
  getUser,
} from '@/modules/core/client/services/angular-compat';

const mockAngularGet = jest.fn();

const mockRootScope = {
  $broadcast: jest.fn(),
  $on: jest.fn(),
};

describe('angular-compat service', () => {
  const analytics = { eventTrack: jest.fn() };
  const state = { go: jest.fn() };
  const stateParams = { tribe: 'nomads' };
  const authentication = { user: { _id: 'user-1' } };
  const originalAngular = window.angular;

  beforeEach(() => {
    window.angular = {
      element: jest.fn(() => {
        return {
          injector: jest.fn(() => ({
            get: mockAngularGet,
          })),
        };
      }),
    };
    mockAngularGet.mockReset();
    mockRootScope.$broadcast.mockReset();
    mockRootScope.$on.mockReset();
    analytics.eventTrack.mockReset();
    state.go.mockReset();
    authentication.user = { _id: 'user-1' };

    mockAngularGet.mockImplementation(name => {
      if (name === '$rootScope') {
        return mockRootScope;
      }
      if (name === '$analytics') {
        return analytics;
      }
      if (name === '$stateParams') {
        return stateParams;
      }
      if (name === '$state') {
        return state;
      }
      if (name === 'Authentication') {
        return authentication;
      }
      return undefined;
    });
  });

  afterEach(() => {
    window.angular = originalAngular;
  });

  it('forwards broadcasts to root scope', () => {
    $broadcast('test-event', { id: 'one' });

    expect(mockRootScope.$broadcast).toHaveBeenCalledWith('test-event', {
      id: 'one',
    });
  });

  it('forwards subscriptions to root scope', () => {
    const listener = jest.fn();
    $on('test-event', listener);

    expect(mockRootScope.$on).toHaveBeenCalledWith('test-event', listener);
  });

  it('forwards analytics events', () => {
    eventTrack('join', { category: 'test' });

    expect(analytics.eventTrack).toHaveBeenCalledWith('join', {
      category: 'test',
    });
  });

  it('forwards route parameter reads and state transitions', () => {
    expect(getRouteParams()).toBe(stateParams);
    go('signup', { tribe: 'travellers' });

    expect(state.go).toHaveBeenCalledWith('signup', { tribe: 'travellers' });
  });

  it('returns cached authentication user', () => {
    expect(getUser()).toBe(authentication.user);
  });

  it('falls back to browser events when Angular is not bootstrapped', () => {
    const listener = jest.fn();
    window.angular = undefined;

    const unsubscribe = $on('fallback-event', listener);
    $broadcast('fallback-event', { id: 'fallback' });

    expect(listener).toHaveBeenCalledWith(null, { id: 'fallback' });

    listener.mockReset();
    window.dispatchEvent(new CustomEvent('tr:fallback-event'));
    expect(listener).toHaveBeenCalledWith(null);

    unsubscribe();
  });

  it('returns null helpers when Angular has no injector', () => {
    window.angular = {
      element: jest.fn(() => ({
        injector: jest.fn(() => null),
      })),
    };

    expect($broadcast('ignored')).toBeUndefined();
    expect(eventTrack('ignored')).toBeUndefined();
    expect(go('ignored')).toBeUndefined();
    expect(getRouteParams()).toEqual({});
  });

  it('returns empty route params when Angular state params are unavailable', () => {
    window.angular = {
      element: jest.fn(() => ({
        injector: jest.fn(() => ({
          get: jest.fn(() => undefined),
        })),
      })),
    };

    expect(getRouteParams()).toEqual({});
  });

  it('falls back to window.user when authentication is unavailable', () => {
    window.user = { _id: 'window-user' };
    window.angular = undefined;

    expect(getUser()).toEqual({ _id: 'window-user' });

    delete window.user;
  });

  it('falls back to window.user when authentication has no user', () => {
    window.user = { _id: 'window-user' };
    mockAngularGet.mockImplementation(name => {
      if (name === 'Authentication') {
        return {};
      }
      return undefined;
    });

    expect(getUser()).toEqual({ _id: 'window-user' });

    delete window.user;
  });

  it('returns null when no authenticated user is available', () => {
    window.angular = undefined;
    window.user = null;

    expect(getUser()).toBeNull();
  });
});

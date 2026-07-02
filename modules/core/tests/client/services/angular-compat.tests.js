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

    unsubscribe();
  });
});

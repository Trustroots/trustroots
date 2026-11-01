import {
  broadcastClientEvent,
  onClientEvent,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';

describe('client runtime helpers', () => {
  afterEach(() => {
    delete window.ga;
    window.history.pushState({}, '', '/');
  });

  it('broadcasts and receives browser events with arguments', () => {
    const listener = jest.fn<void, [error: null, ...args: unknown[]]>();
    const unsubscribe = onClientEvent('photoCreditsUpdated', listener);

    broadcastClientEvent('photoCreditsUpdated', { _id: 'user-1' });

    expect(listener).toHaveBeenCalledWith(null, { _id: 'user-1' });
    unsubscribe();
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
});

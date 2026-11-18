import {
  broadcastClientEvent,
  onClientEvent,
} from '@/modules/core/client/services/client-runtime';

describe('client runtime helpers', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('broadcasts and receives browser events with arguments', () => {
    const listener =
      vi.fn<(...args: [error: null, ...args: unknown[]]) => void>();
    const unsubscribe = onClientEvent('photoCreditsUpdated', listener);

    broadcastClientEvent('photoCreditsUpdated', { _id: 'user-1' });

    expect(listener).toHaveBeenCalledWith(null, { _id: 'user-1' });
    unsubscribe();
  });

  it('broadcasts events without arguments', () => {
    const listener =
      vi.fn<(...args: [error: null, ...args: unknown[]]) => void>();
    const unsubscribe = onClientEvent('empty', listener);

    broadcastClientEvent('empty');
    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();
  });

  it('handles events without a detail payload', () => {
    const listener =
      vi.fn<(...args: [error: null, ...args: unknown[]]) => void>();
    const unsubscribe = onClientEvent('bare', listener);
    window.dispatchEvent(new Event('tr:bare'));
    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();
  });
});

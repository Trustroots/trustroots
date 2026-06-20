import createSubscribable from '@/modules/core/client/utils/subscribable';

describe('createSubscribable', () => {
  it('notifies all subscribers with the payload', () => {
    const { subscribe, notify } = createSubscribable();
    const first = jest.fn();
    const second = jest.fn();

    subscribe(first);
    subscribe(second);
    notify({ count: 1 });

    expect(first).toHaveBeenCalledWith({ count: 1 });
    expect(second).toHaveBeenCalledWith({ count: 1 });
  });

  it('stops notifying unsubscribed callbacks', () => {
    const { subscribe, notify } = createSubscribable();
    const subscriber = jest.fn();
    const unsubscribe = subscribe(subscriber);

    unsubscribe();
    unsubscribe();
    notify('ignored');

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('does not skip later subscribers when a callback unsubscribes itself', () => {
    const { subscribe, notify } = createSubscribable();
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = subscribe(payload => {
      first(payload);
      unsubscribeFirst();
    });
    subscribe(second);

    notify('first-notification');
    notify('second-notification');

    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('first-notification');
    expect(second).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenNthCalledWith(1, 'first-notification');
    expect(second).toHaveBeenNthCalledWith(2, 'second-notification');
  });

  it('continues notifying other subscribers when one throws', () => {
    const { subscribe, notify } = createSubscribable();
    const error = new Error('first failed');
    const throwingSubscriber = jest.fn(() => {
      throw error;
    });
    const healthySubscriber = jest.fn();

    subscribe(throwingSubscriber);
    subscribe(healthySubscriber);

    expect(() => notify('payload')).toThrow('Errors! Error: first failed');
    expect(throwingSubscriber).toHaveBeenCalledWith('payload');
    expect(healthySubscriber).toHaveBeenCalledWith('payload');
  });

  it('reports all subscriber errors after notification finishes', () => {
    const { subscribe, notify } = createSubscribable();

    subscribe(() => {
      throw new Error('first failed');
    });
    subscribe(() => {
      throw new Error('second failed');
    });

    expect(() => notify()).toThrow(
      'Errors! Error: first failed, Error: second failed',
    );
  });
});

import { enable as enableUnreadMessageCountPolling } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

jest.mock(
  '@/modules/messages/client/services/unread-message-count.client.service',
);
jest.mock('@/modules/messages/client/services/visibility.client.service');
jest.mock(
  '@/modules/messages/client/services/messages-count-favicon-updater.client.service',
);

describe('messages client run configuration', () => {
  let registeredRun;

  beforeEach(() => {
    registeredRun = null;
    jest.spyOn(angular, 'module').mockImplementation(() => ({
      run: callback => {
        registeredRun = callback;
      },
    }));

    jest.isolateModules(() => {
      require('@/modules/messages/client/config/messages.client.run');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('registers run block on messages module', () => {
    expect(angular.module).toHaveBeenCalledWith('messages');
    expect(typeof registeredRun).toBe('function');
  });

  it('registers a run block that enables visibility and favicon updates', () => {
    const timeout = jest.fn();

    registeredRun(timeout);

    expect(enableVisibilityWatching).toHaveBeenCalledTimes(1);
    expect(enableFaviconUpdater).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(enableUnreadMessageCountPolling);
    expect(enableUnreadMessageCountPolling).not.toHaveBeenCalled();
  });

  it('defers unread count polling through $timeout', () => {
    const timeout = jest.fn();

    registeredRun(timeout);

    const scheduledFn = timeout.mock.calls[0][0];
    expect(scheduledFn).toEqual(expect.any(Function));
    scheduledFn();

    expect(enableUnreadMessageCountPolling).toHaveBeenCalledTimes(1);
  });
});

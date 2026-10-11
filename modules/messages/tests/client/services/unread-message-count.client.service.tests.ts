import { EventEmitter } from 'events';

import {
  broadcastClientEvent,
  onClientEvent,
  getCurrentUser,
} from '@/modules/core/client/services/client-runtime';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import { generateClientUser } from '@/testutils/common/data.common.testutil';

jest.mock('@/modules/core/client/services/client-runtime');
jest.mock('@/modules/messages/client/api/messages.api');

type UnreadMessageCountService =
  typeof import('@/modules/messages/client/services/unread-message-count.client.service');
type VisibilityService =
  typeof import('@/modules/messages/client/services/visibility.client.service');
type VisibilityProperty = 'hidden' | 'msHidden' | 'webkitHidden';
let unreadMessageCountService!: UnreadMessageCountService;
let enableVisibilityWatching!: VisibilityService['enable'];
let disableVisibilityWatching!: VisibilityService['disable'];
const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'hidden',
);

beforeEach(() => {
  defineDocumentProperty('hidden', false);

  jest.isolateModules(() => {
    const visibilityService = jest.requireActual<VisibilityService>(
      '@/modules/messages/client/services/visibility.client.service',
    );
    ({ enable: enableVisibilityWatching, disable: disableVisibilityWatching } =
      visibilityService);
    enableVisibilityWatching();
    unreadMessageCountService = jest.requireActual<UnreadMessageCountService>(
      '@/modules/messages/client/services/unread-message-count.client.service',
    );
  });
});

afterEach(() => {
  unreadMessageCountService.disable();
  disableVisibilityWatching();
  restoreProperty('hidden', originalHiddenDescriptor);
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const api = {
  messages: jest.mocked(messagesAPI),
};

const emitter = new EventEmitter();
const mockedOnClientEvent = jest.mocked(onClientEvent);
const mockedBroadcastClientEvent = jest.mocked(broadcastClientEvent);
const mockedGetCurrentUser = jest.mocked(getCurrentUser);
mockedOnClientEvent.mockImplementation((eventName, listener) => {
  emitter.on(eventName, (...args: unknown[]) => listener(null, ...args));
  return () => emitter.removeAllListeners(eventName);
});
mockedBroadcastClientEvent.mockImplementation((eventName, ...args) =>
  emitter.emit(eventName, ...args),
);
afterEach(() => emitter.removeAllListeners());

describe('Unread Message Count Service', () => {
  const user = generateClientUser({ public: true });
  let unreadCount: number;

  beforeEach(() => {
    unreadCount = 42;
  });

  it('gives value immediately if already logged in', done => {
    mockedGetCurrentUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    unreadMessageCountService.watch(count => {
      expect(count).toBe(unreadCount);
      done();
    });
    unreadMessageCountService.enable();
  });

  it('sends value if user logs in later', done => {
    mockedGetCurrentUser.mockReturnValue(null);
    unreadMessageCountService.watch(count => {
      expect(count).toBe(unreadCount);
      done();
    });
    unreadMessageCountService.enable();
    setTimeout(() => {
      // Now we log in...
      api.messages.unreadCount.mockResolvedValue(unreadCount);
      mockedGetCurrentUser.mockReturnValue(user);
      mockedBroadcastClientEvent('userUpdated');
    }, 100);
  });

  it('stops polling when userUpdated fires without a logged-in user', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    mockedGetCurrentUser.mockReturnValue(null);

    unreadMessageCountService.enable();
    mockedBroadcastClientEvent('userUpdated');

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('does not notify subscribers when unread count is unchanged', async () => {
    mockedGetCurrentUser.mockReturnValue(user);
    api.messages.unreadCount
      .mockResolvedValueOnce(unreadCount)
      .mockResolvedValueOnce(unreadCount);

    const watcher = jest.fn<void, [count: number]>();
    unreadMessageCountService.watch(watcher);

    await unreadMessageCountService.update();
    await unreadMessageCountService.update();

    expect(watcher).toHaveBeenCalledTimes(1);
    expect(watcher).toHaveBeenCalledWith(unreadCount);
  });

  it('registers visibility and user update hooks only once when enabled repeatedly', () => {
    mockedGetCurrentUser.mockReturnValue(user);

    unreadMessageCountService.enable();
    unreadMessageCountService.enable();

    expect(onClientEvent).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount('userUpdated')).toBe(1);
  });

  it('does nothing when disabled before enable', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    unreadMessageCountService.disable();

    expect(clearIntervalSpy).not.toHaveBeenCalled();
    expect(emitter.listenerCount('userUpdated')).toBe(0);
  });

  it('sets a background polling interval when document is hidden', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    disableVisibilityWatching();
    defineDocumentProperty('hidden', true);
    enableVisibilityWatching();
    mockedGetCurrentUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);

    unreadMessageCountService.enable();

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 300000);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('resets polling interval when userUpdated fires while already enabled', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    defineDocumentProperty('hidden', false);
    mockedGetCurrentUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);

    unreadMessageCountService.enable();
    await Promise.resolve();

    mockedBroadcastClientEvent('userUpdated');

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
  });

  it('does nothing when no user is logged in during update', async () => {
    mockedGetCurrentUser.mockReturnValue(null);

    await unreadMessageCountService.update();

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
  });

  it('does nothing when logged user is not public during update', async () => {
    mockedGetCurrentUser.mockReturnValue({ ...user, public: false });

    await unreadMessageCountService.update();

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
  });

  it('delivers cached unread count to late subscribers', async () => {
    mockedGetCurrentUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    await unreadMessageCountService.update();

    const watcher = jest.fn();
    unreadMessageCountService.watch(watcher);

    expect(watcher).toHaveBeenCalledWith(unreadCount);
  });
});

function defineDocumentProperty(
  name: VisibilityProperty,
  value: boolean | undefined,
): void {
  Object.defineProperty(document, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreProperty(
  name: VisibilityProperty,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (!descriptor) {
    Reflect.deleteProperty(document, name);
    return;
  }

  Object.defineProperty(document, name, descriptor);
}

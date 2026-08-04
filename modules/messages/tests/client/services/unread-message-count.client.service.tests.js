import faker from 'faker';

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

let unreadMessageCountService;
let enableVisibilityWatching;
let disableVisibilityWatching;
const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'hidden',
);

beforeEach(() => {
  defineDocumentProperty('hidden', false);

  jest.isolateModules(() => {
    ({
      enable: enableVisibilityWatching,
      disable: disableVisibilityWatching,
    } = require('@/modules/messages/client/services/visibility.client.service'));
    enableVisibilityWatching();
    unreadMessageCountService = require('@/modules/messages/client/services/unread-message-count.client.service');
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
  messages: messagesAPI,
};

const emitter = new EventEmitter();
onClientEvent.mockImplementation(emitter.on.bind(emitter));
broadcastClientEvent.mockImplementation(emitter.emit.bind(emitter));
afterEach(() => emitter.removeAllListeners());

describe('Unread Message Count Service', () => {
  const user = generateClientUser({ public: true });
  let unreadCount;

  beforeEach(() => {
    unreadCount = faker.datatype.number(100);
  });

  it('gives value immediately if already logged in', done => {
    getCurrentUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    unreadMessageCountService.watch(count => {
      expect(count).toBe(unreadCount);
      done();
    });
    unreadMessageCountService.enable();
  });

  it('sends value if user logs in later', done => {
    getCurrentUser.mockReturnValue(null);
    unreadMessageCountService.watch(count => {
      expect(count).toBe(unreadCount);
      done();
    });
    unreadMessageCountService.enable();
    setTimeout(() => {
      // Now we log in...
      api.messages.unreadCount.mockResolvedValue(unreadCount);
      getCurrentUser.mockReturnValue(user);
      broadcastClientEvent('userUpdated');
    }, 100);
  });

  it('stops polling when userUpdated fires without a logged-in user', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    getCurrentUser.mockReturnValue(null);

    unreadMessageCountService.enable();
    broadcastClientEvent('userUpdated');

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('does not notify subscribers when unread count is unchanged', async () => {
    getCurrentUser.mockReturnValue(user);
    api.messages.unreadCount
      .mockResolvedValueOnce(unreadCount)
      .mockResolvedValueOnce(unreadCount);

    const watcher = jest.fn();
    unreadMessageCountService.watch(watcher);

    await unreadMessageCountService.update();
    await unreadMessageCountService.update();

    expect(watcher).toHaveBeenCalledTimes(1);
    expect(watcher).toHaveBeenCalledWith(unreadCount);
  });

  it('registers visibility and user update hooks only once when enabled repeatedly', () => {
    getCurrentUser.mockReturnValue(user);

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
    getCurrentUser.mockReturnValue(user);
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
    getCurrentUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);

    unreadMessageCountService.enable();
    await Promise.resolve();

    broadcastClientEvent('userUpdated');

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
  });

  it('does nothing when no user is logged in during update', async () => {
    getCurrentUser.mockReturnValue(null);

    await unreadMessageCountService.update();

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
  });

  it('does nothing when logged user is not public during update', async () => {
    getCurrentUser.mockReturnValue({ ...user, public: false });

    await unreadMessageCountService.update();

    expect(api.messages.unreadCount).not.toHaveBeenCalled();
  });

  it('delivers cached unread count to late subscribers', async () => {
    getCurrentUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    await unreadMessageCountService.update();

    const watcher = jest.fn();
    unreadMessageCountService.watch(watcher);

    expect(watcher).toHaveBeenCalledWith(unreadCount);
  });
});

function defineDocumentProperty(name, value) {
  Object.defineProperty(document, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreProperty(name, descriptor) {
  if (!descriptor) {
    // eslint-disable-next-line no-param-reassign
    delete document[name];
    return;
  }

  Object.defineProperty(document, name, descriptor);
}

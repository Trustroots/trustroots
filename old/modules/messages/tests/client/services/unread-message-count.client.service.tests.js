import faker from 'faker';

import { EventEmitter } from 'events';

import {
  $broadcast,
  $on,
  getUser,
} from '@/modules/core/client/services/angular-compat';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import { generateClientUser } from '@/testutils/common/data.common.testutil';
import {
  enable as enableVisibilityWatching,
  disable as disableVisibilityWatching,
} from '@/modules/messages/client/services/visibility.client.service';

beforeAll(enableVisibilityWatching);
afterAll(disableVisibilityWatching);

jest.mock('@/modules/core/client/services/angular-compat');
jest.mock('@/modules/messages/client/api/messages.api');

let unreadMessageCountService;

beforeEach(() => {
  jest.isolateModules(() => {
    unreadMessageCountService = require('@/modules/messages/client/services/unread-message-count.client.service');
  });
});

afterEach(() => unreadMessageCountService.disable());

afterEach(() => jest.clearAllMocks());

const api = {
  messages: messagesAPI,
};

const emitter = new EventEmitter();
$on.mockImplementation(emitter.on.bind(emitter));
$broadcast.mockImplementation(emitter.emit.bind(emitter));
afterEach(() => emitter.removeAllListeners());

describe('Unread Message Count Service', () => {
  const user = generateClientUser({ public: true });
  let unreadCount;

  beforeEach(() => {
    unreadCount = faker.random.number(100);
  });

  it('gives value immediately if already logged in', done => {
    getUser.mockReturnValue(user);
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    unreadMessageCountService.watch(count => {
      expect(count).toBe(unreadCount);
      done();
    });
    unreadMessageCountService.enable();
  });

  it('sends value if user logs in later', done => {
    getUser.mockReturnValue(null);
    unreadMessageCountService.watch(count => {
      expect(count).toBe(unreadCount);
      done();
    });
    unreadMessageCountService.enable();
    setTimeout(() => {
      // Now we log in...
      api.messages.unreadCount.mockResolvedValue(unreadCount);
      getUser.mockReturnValue(user);
      $broadcast('userUpdated');
    }, 100);
  });
});

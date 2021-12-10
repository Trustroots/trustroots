import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import UnreadCount from 'modules/messages/client/components/UnreadCount.component';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import { getUser } from '@/modules/core/client/services/angular-compat';
import { generateClientUser } from '@/testutils/common/data.common.testutil';
import faker from 'faker';
import {
  enable as enableVisibilityWatching,
  disable as disableVisibilityWatching,
} from '@/modules/messages/client/services/visibility.client.service';
import {
  enable as enableUnreadMessageCountPolling,
  disable as disableUnreadMessageCountPolling,
  update as updateUnreadCount,
} from '@/modules/messages/client/services/unread-message-count.client.service';

beforeAll(enableVisibilityWatching);
afterAll(disableVisibilityWatching);

const api = {
  messages: messagesAPI,
};

jest.mock('@/modules/messages/client/api/messages.api');
jest.mock('@/modules/core/client/services/angular-compat');

afterEach(() => jest.clearAllMocks());

const user = generateClientUser({ public: true });

getUser.mockReturnValue(user);

afterEach(disableUnreadMessageCountPolling);

describe('<UnreadCount>', () => {
  it('renders with count > 0', async () => {
    const unreadCount = faker.random.number({ min: 1, max: 100 });
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    enableUnreadMessageCountPolling();
    const { findByLabelText } = render(<UnreadCount />);
    const el = await findByLabelText(`${unreadCount} unread messages`);
    expect(el).toHaveTextContent(unreadCount);
  });

  it('renders nothing when count is 0', async () => {
    api.messages.unreadCount.mockResolvedValue(0);
    enableUnreadMessageCountPolling();
    await updateUnreadCount();
    const { container } = render(<UnreadCount />);
    expect(container).toBeEmptyDOMElement();
  });
});

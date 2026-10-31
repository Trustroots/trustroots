import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import UnreadCount from 'modules/messages/client/components/UnreadCount.component';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import {
  enable as enableVisibilityWatching,
  disable as disableVisibilityWatching,
} from '@/modules/messages/client/services/visibility.client.service';
import {
  start as startUnreadMessageCountPolling,
  update as updateUnreadCount,
} from '@/modules/messages/client/services/unread-message-count.client.service';

beforeAll(enableVisibilityWatching);
afterAll(disableVisibilityWatching);

const api = {
  messages: jest.mocked(messagesAPI),
};

jest.mock('@/modules/messages/client/api/messages.api');

afterEach(() => jest.clearAllMocks());

let stopUnreadMessageCountPolling: () => void;

afterEach(() => stopUnreadMessageCountPolling());

describe('<UnreadCount>', () => {
  it('renders with count > 0', async () => {
    const unreadCount = 42;
    api.messages.unreadCount.mockResolvedValue(unreadCount);
    stopUnreadMessageCountPolling = startUnreadMessageCountPolling();
    const { findByLabelText } = render(<UnreadCount />);
    const el = await findByLabelText(`${unreadCount} unread messages`);
    expect(el).toHaveTextContent(String(unreadCount));
  });

  it('renders nothing when count is 0', async () => {
    api.messages.unreadCount.mockResolvedValue(0);
    stopUnreadMessageCountPolling = startUnreadMessageCountPolling();
    await updateUnreadCount();
    const { container } = render(<UnreadCount />);
    expect(container).toBeEmptyDOMElement();
  });
});

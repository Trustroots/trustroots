import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Thread from '@/modules/messages/client/components/Thread.component';
import * as usersAPI from '@/modules/users/client/api/users.api';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import { update as updateUnreadMessageCount } from '@/modules/messages/client/services/unread-message-count.client.service';
import {
  generateClientUser,
  generateMessage,
} from '@/testutils/client/data.client.testutil';
import { getRouteParams } from '@/modules/core/client/services/angular-compat';

const api = {
  users: usersAPI,
  messages: messagesAPI,
};

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/messages/client/api/messages.api');
jest.mock(
  '@/modules/messages/client/services/unread-message-count.client.service',
);
jest.mock('@/modules/core/client/services/angular-compat');
jest.mock('react-responsive', () => ({
  useMediaQuery: () => true,
}));
jest.mock('@/modules/core/client/components/TrEditor', () => {
  function MockTrEditor({ id, onChange, text }) {
    return (
      <textarea
        id={id}
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }
  MockTrEditor.propTypes = {
    id: () => null,
    onChange: () => null,
    text: () => null,
  };

  return MockTrEditor;
});

beforeEach(() => {
  api.messages.markRead.mockResolvedValue();
});

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

const me = {
  ...generateClientUser({ public: true }),
  memberIds: [],
};
const otherUser = {
  ...generateClientUser({ public: true }),
  member: [],
};

getRouteParams.mockReturnValue({
  username: otherUser.username,
});

async function waitForLoader() {
  await waitForElementToBeRemoved(() => screen.getByText('Wait a moment…'));
}

describe('<Thread>', () => {
  beforeEach(() => {
    api.users.fetch.mockResolvedValueOnce(otherUser);
  });

  describe('no messages', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });
    });

    it('does not allow sending a message when the profile is too short', async () => {
      const { findByText, queryByRole } = render(
        <Thread user={me} profileMinimumLength={9999} />,
      );
      await findByText(/Your profile seems quite empty/);
      expect(queryByRole('textbox')).not.toBeInTheDocument();
      expect(api.users.fetch).toHaveBeenCalledWith(otherUser.username);
      expect(api.messages.fetchMessages).toHaveBeenCalledWith(otherUser._id);
    });

    it('shows reply box if profile is long enough', async () => {
      const { findByRole, queryByText } = render(
        <Thread user={me} profileMinimumLength={0} />,
      );
      const form = await findByRole('form');
      expect(queryByText(/You haven't been talking yet/)).toBeInTheDocument();
      expect(within(form).queryByRole('textbox')).toBeInTheDocument();
    });

    it('sends a typed reply and appends the API response to the thread', async () => {
      api.messages.sendMessage.mockResolvedValueOnce({
        data: {
          ...generateMessage(me),
          _id: 'sent-message',
          content: '<p>Hello, can I stay next Tuesday?</p>',
          created: '2026-06-05T12:00:00.000Z',
        },
      });

      render(<Thread user={me} profileMinimumLength={0} />);

      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, {
        target: { value: '<p>Hello, can I stay next Tuesday?</p>' },
      });
      fireEvent.submit(editor.closest('form'));

      await waitFor(() =>
        expect(api.messages.sendMessage).toHaveBeenCalledWith(
          otherUser._id,
          '<p>Hello, can I stay next Tuesday?</p>',
        ),
      );
      expect(
        await screen.findByText('Hello, can I stay next Tuesday?'),
      ).toBeInTheDocument();
    });
  });

  describe('only messages from other user', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [generateMessage(otherUser)],
      });
    });

    it('shows quick reply buttons', async () => {
      const { getByTestId } = render(
        <Thread user={me} profileMinimumLength={0} />,
      );
      await waitForLoader();
      const quickReply = getByTestId('quick-reply');
      const buttons = within(quickReply).queryAllByRole('button');
      expect(buttons.length).toBe(3);
      ['Yes, I can host!', "Sorry I can't host", 'Write back'].forEach(
        (content, i) => {
          expect(buttons[i]).toHaveTextContent(content);
        },
      );
    });

    it('sends a hosting quick reply through the thread API', async () => {
      api.messages.sendMessage.mockResolvedValueOnce({
        data: {
          ...generateMessage(me),
          _id: 'quick-reply-message',
          content: '<p data-hosting="yes"><b><i>Yes, I can host!</i></b></p>',
          created: '2026-06-05T12:00:00.000Z',
        },
      });

      render(<Thread user={me} profileMinimumLength={0} />);
      await waitForLoader();

      fireEvent.click(screen.getByRole('button', { name: 'Yes, I can host!' }));

      await waitFor(() =>
        expect(api.messages.sendMessage).toHaveBeenCalledWith(
          otherUser._id,
          expect.stringContaining('data-hosting="yes"'),
        ),
      );
      await waitFor(() =>
        expect(screen.queryByTestId('quick-reply')).not.toBeInTheDocument(),
      );
      expect(screen.getByText('Yes, I can host!')).toBeInTheDocument();
    });
  });

  describe('unread messages from other user', () => {
    it('marks them read and refreshes the unread message count', async () => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [
          {
            ...generateMessage(otherUser),
            _id: 'unread-message',
            read: false,
          },
        ],
      });

      render(<Thread user={me} profileMinimumLength={0} />);
      await waitForLoader();

      await waitFor(() =>
        expect(api.messages.markRead).toHaveBeenCalledWith(['unread-message']),
      );
      expect(updateUnreadMessageCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('messages from both users', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [generateMessage(otherUser), generateMessage(me)],
      });
    });

    it('does not show the quick reply buttons', async () => {
      const { queryByTestId } = render(
        <Thread user={me} profileMinimumLength={0} />,
      );
      await waitForLoader();
      expect(queryByTestId('quick-reply')).not.toBeInTheDocument();
    });
  });
});

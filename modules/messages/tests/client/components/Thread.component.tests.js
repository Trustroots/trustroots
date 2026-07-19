import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
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
import * as angularCompat from '@/modules/core/client/services/client-runtime';

const api = {
  users: usersAPI,
  messages: messagesAPI,
};

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/messages/client/api/messages.api');
jest.mock(
  '@/modules/messages/client/services/unread-message-count.client.service',
);
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(),
  navigate: jest.fn(),
}));
let mockIsExtraSmall = true;
jest.mock('react-responsive', () => ({
  useMediaQuery: () => mockIsExtraSmall,
}));
jest.mock('@/modules/messages/client/components/InfiniteMessages', () => {
  const React = require('react');

  function MockInfiniteMessages({ children, onFetchMore }) {
    return (
      <div data-testid="infinite-messages">
        <button type="button" onClick={onFetchMore}>
          Fetch older messages
        </button>
        {children}
      </div>
    );
  }
  MockInfiniteMessages.propTypes = {
    children: () => null,
    onFetchMore: () => null,
  };

  return MockInfiniteMessages;
});
jest.mock('@/modules/users/client/components/Monkeybox', () => {
  return function MockMonkeybox() {
    return <div data-testid="monkeybox" />;
  };
});
jest.mock('@/modules/support/client/components/ReportMember.component', () => {
  function MockReportMember({ username }) {
    return <button type="button">Report {username}</button>;
  }
  MockReportMember.propTypes = {
    username: () => null,
  };
  return MockReportMember;
});
jest.mock('@/modules/users/client/components/BlockMember.component', () => {
  function MockBlockMember({ username }) {
    return <button type="button">Block {username}</button>;
  }
  MockBlockMember.propTypes = {
    username: () => null,
  };
  return MockBlockMember;
});
jest.mock(
  '@/modules/references-thread/client/components/ReferenceThread',
  () => {
    function MockReferenceThread({ userToId }) {
      return <div>References for {userToId}</div>;
    }
    MockReferenceThread.propTypes = {
      userToId: () => null,
    };
    return MockReferenceThread;
  },
);
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

const me = {
  ...generateClientUser({ public: true }),
  memberIds: [],
};
const otherUser = {
  ...generateClientUser({ public: true }),
  member: [],
};

beforeEach(() => {
  api.users.fetch.mockReset();
  api.messages.fetchMessages.mockReset();
  api.messages.sendMessage.mockReset();
  api.messages.markRead.mockReset();

  api.users.fetch.mockResolvedValue(otherUser);
  api.messages.fetchMessages.mockResolvedValue({ messages: [] });
  api.messages.markRead.mockResolvedValue();
});

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

let routeParams = {
  username: otherUser.username,
};

angularCompat.getCurrentRouteParams.mockReturnValue(routeParams);

describe('<Thread>', () => {
  beforeEach(() => {
    api.users.fetch.mockResolvedValue(otherUser);
    mockIsExtraSmall = true;
    routeParams = {
      username: otherUser.username,
    };
    angularCompat.getCurrentRouteParams.mockReturnValue(routeParams);
  });

  it('shows the activation prompt and skips loading for private users', () => {
    render(<Thread user={{ ...me, public: false }} profileMinimumLength={0} />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Sorry, you need to first activate your profile by confirming your email.',
    );
    expect(api.users.fetch).not.toHaveBeenCalled();
    expect(api.messages.fetchMessages).not.toHaveBeenCalled();
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
      expect(editor).toBeInTheDocument();
      fireEvent.change(editor, {
        target: { value: '<p>Hello, can I stay next Tuesday?</p>' },
      });
      const replyForm = editor.closest('form');
      expect(replyForm).toBeTruthy();
      fireEvent.submit(replyForm);

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

  it('redirects to inbox when opening own profile thread', async () => {
    routeParams = {
      username: me.username,
    };
    angularCompat.getCurrentRouteParams.mockReturnValue(routeParams);
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });

    render(<Thread user={me} profileMinimumLength={0} />);

    await waitFor(() =>
      expect(angularCompat.navigate).toHaveBeenCalledWith('inbox'),
    );
    expect(
      screen.queryByText(/You haven't been talking yet/),
    ).not.toBeInTheDocument();
  });

  it('shows removed user note when user has been deleted and userId exists', async () => {
    routeParams = {
      username: otherUser.username,
      userId: otherUser._id,
    };
    angularCompat.getCurrentRouteParams.mockReturnValue(routeParams);

    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });

    render(<Thread user={me} profileMinimumLength={0} />);

    await waitFor(() =>
      expect(
        screen.getByText('Member is not available anymore.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('shows missing-member message when deleted user cannot be identified', async () => {
    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText("This user isn't a member anymore."),
    ).toBeInTheDocument();
    expect(api.messages.fetchMessages).not.toHaveBeenCalled();
  });

  it('shows a load failure when member lookup fails unexpectedly', async () => {
    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 500,
      },
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText('Failed to load messages. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(api.messages.fetchMessages).not.toHaveBeenCalled();
  });

  it('repairs missing message endpoints for removed users', async () => {
    routeParams = {
      username: otherUser.username,
      userId: otherUser._id,
    };
    angularCompat.getCurrentRouteParams.mockReturnValue(routeParams);

    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...generateMessage(otherUser),
          _id: 'removed-user-message',
          content: 'I used to be here',
          userFrom: null,
          userTo: null,
        },
      ],
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(await screen.findByText('I used to be here')).toBeInTheDocument();
    expect(
      screen.getByText('Member is not available anymore.'),
    ).toBeInTheDocument();
    expect(api.messages.markRead).toHaveBeenCalledWith([
      'removed-user-message',
    ]);
  });

  it('keeps existing message endpoints for removed users', async () => {
    routeParams = {
      username: otherUser.username,
      userId: otherUser._id,
    };
    angularCompat.getCurrentRouteParams.mockReturnValue(routeParams);

    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...generateMessage(otherUser),
          _id: 'removed-user-complete-message',
          content: 'My endpoints were complete',
          userFrom: { _id: otherUser._id },
          userTo: { _id: me._id },
        },
      ],
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText('My endpoints were complete'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Member is not available anymore.'),
    ).toBeInTheDocument();
  });

  it('shows blocked banner and disables replies for blocked users', async () => {
    const blockedMe = {
      ...me,
      blocked: [otherUser._id],
    };

    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...generateMessage(otherUser),
          _id: 'blocked-msg',
        },
      ],
    });

    render(<Thread user={blockedMe} profileMinimumLength={0} />);

    const blockedAlert = await screen.findByRole('alert');

    expect(blockedAlert).toHaveTextContent('You have blocked this member.');
    expect(
      screen.queryByRole('button', { name: 'Send' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('loads older messages using next pagination params', async () => {
    const newestMessage = {
      ...generateMessage(otherUser),
      _id: 'newest-message',
      content: 'Newest message',
      created: '2026-06-05T12:00:00.000Z',
      read: true,
    };
    const oldestMessage = {
      ...generateMessage(otherUser),
      _id: 'oldest-message',
      content: 'Oldest message',
      created: '2026-06-04T12:00:00.000Z',
      read: true,
    };
    api.messages.fetchMessages
      .mockResolvedValueOnce({
        messages: [newestMessage],
        nextParams: { before: 'older-page' },
      })
      .mockResolvedValueOnce({
        messages: [oldestMessage],
        nextParams: null,
      });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(await screen.findByText('Newest message')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Fetch older messages' }),
    );

    await waitFor(() =>
      expect(api.messages.fetchMessages).toHaveBeenLastCalledWith(
        otherUser._id,
        { before: 'older-page' },
      ),
    );
    expect(await screen.findByText('Oldest message')).toBeInTheDocument();
  });

  it('prepends older paginated messages in chronological order', async () => {
    const newestMessage = {
      ...generateMessage(otherUser),
      _id: 'newest-message',
      content: 'Newest message',
      created: '2026-06-05T12:00:00.000Z',
      read: true,
    };
    const oldestMessage = {
      ...generateMessage(otherUser),
      _id: 'oldest-message',
      content: 'Oldest message',
      created: '2026-06-03T12:00:00.000Z',
      read: true,
    };
    const middleMessage = {
      ...generateMessage(otherUser),
      _id: 'middle-message',
      content: 'Middle message',
      created: '2026-06-04T12:00:00.000Z',
      read: true,
    };
    api.messages.fetchMessages
      .mockResolvedValueOnce({
        messages: [newestMessage],
        nextParams: { before: 'older-page' },
      })
      .mockResolvedValueOnce({
        messages: [middleMessage, oldestMessage],
        nextParams: null,
      });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(await screen.findByText('Newest message')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Fetch older messages' }),
    );

    await screen.findByText('Middle message');
    const messages = screen.getAllByText(/message$/i);
    expect(messages.map(message => message.textContent)).toEqual([
      'Oldest message',
      'Middle message',
      'Newest message',
    ]);
  });

  it('does not fetch older messages when no next pagination params exist', async () => {
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...generateMessage(otherUser),
          _id: 'only-message',
          content: 'Only message',
          created: '2026-06-05T12:00:00.000Z',
        },
      ],
      nextParams: null,
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(await screen.findByText('Only message')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Fetch older messages' }),
    );

    await waitFor(() =>
      expect(api.messages.fetchMessages).toHaveBeenCalledTimes(1),
    );
  });

  it('displays an explicit rate-limit alert when send fails with 429', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });
    api.messages.sendMessage.mockRejectedValueOnce({
      response: { status: 429 },
    });

    render(<Thread user={me} profileMinimumLength={0} />);
    const editor = await screen.findByRole('textbox');
    expect(editor).toBeInTheDocument();

    fireEvent.change(editor, {
      target: {
        value: '<p>Can I host this week?</p>',
      },
    });
    const replyForm = editor.closest('form');
    expect(replyForm).toBeTruthy();
    fireEvent.submit(replyForm);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'You are writing to too many people too fast. Slow down and try later again.',
      ),
    );
  });

  it('displays a generic alert when send fails without a rate limit', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });
    api.messages.sendMessage.mockRejectedValueOnce({
      response: { status: 500 },
    });

    render(<Thread user={me} profileMinimumLength={0} />);
    const editor = await screen.findByRole('textbox');

    fireEvent.change(editor, {
      target: {
        value: '<p>Can I host this week?</p>',
      },
    });
    const replyForm = editor.closest('form');
    expect(replyForm).toBeTruthy();
    fireEvent.submit(replyForm);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to send the message. Perhaps your internet went down? Please try again.',
      ),
    );
  });

  it('shows sidebar actions and references on wider screens', async () => {
    mockIsExtraSmall = false;
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...generateMessage(otherUser),
          _id: 'sidebar-message',
          content: 'Message with sidebar',
          read: true,
        },
      ],
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(await screen.findByTestId('monkeybox')).toBeInTheDocument();
    expect(
      screen.getByText(`References for ${otherUser._id}`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Report ${otherUser.username}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Block ${otherUser.username}` }),
    ).toBeInTheDocument();
  });

  describe('only messages from other user', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [generateMessage(otherUser)],
      });
    });

    it('shows quick reply buttons', async () => {
      render(<Thread user={me} profileMinimumLength={0} />);
      const quickReply = await screen.findByTestId('quick-reply');
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
      await screen.findByRole('button', { name: 'Yes, I can host!' });

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
      const unreadMessage = generateMessage(otherUser);
      unreadMessage._id = 'unread-message';
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [unreadMessage],
      });

      render(<Thread user={me} profileMinimumLength={0} />);
      await screen.findByRole('textbox');

      await waitFor(() =>
        expect(api.messages.markRead).toHaveBeenCalledWith(['unread-message']),
      );
      expect(updateUnreadMessageCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('messages from both users', () => {
    beforeEach(() => {
      const messageFromOther = generateMessage(otherUser);
      messageFromOther.content = 'Hi there from other user';
      const messageFromMe = generateMessage(me);
      messageFromMe._id = 'my-message';
      messageFromMe.content = 'Hi there from me';

      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [messageFromOther, messageFromMe],
      });
    });

    it('does not show the quick reply buttons', async () => {
      const { queryByTestId } = render(
        <Thread user={me} profileMinimumLength={0} />,
      );
      await screen.findByText('Hi there from me');

      await waitFor(() => {
        expect(queryByTestId('quick-reply')).not.toBeInTheDocument();
      });
    });
  });
});

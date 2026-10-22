import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import * as messagesApi from '@/modules/admin/client/api/messages.api';
import * as usersApi from '@/modules/admin/client/api/users.api';

jest.mock('@/modules/admin/client/api/messages.api');
jest.mock('@/modules/admin/client/api/users.api');

const mockedMessagesApi = jest.mocked(messagesApi);
const mockedUsersApi = jest.mocked(usersApi);

type MemberFixture = { _id: string; displayName: string; username: string };

const user1 = '111111111111111111111111';
const user2 = '222222222222222222222222';

const alice: MemberFixture = {
  _id: user1,
  displayName: 'Alice Example',
  username: 'alice',
};

const bob: MemberFixture = {
  _id: user2,
  displayName: 'Bob Example',
  username: 'bob',
};

afterEach(() => {
  jest.resetAllMocks();
  window.history.pushState({}, '', '/');
});

describe('<AdminMessages />', () => {
  it('loads a username conversation and renders it in the normal message style', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/messages?username1=alice&username2=bob',
    );
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce([alice])
      .mockResolvedValueOnce([bob]);
    mockedMessagesApi.getMessages.mockResolvedValueOnce({
      messages: [
        {
          _id: 'message-1',
          content: '<p>Hello <strong>Bob</strong></p>',
          created: '2025-03-04T05:06:07.000Z',
          read: false,
          userFrom: alice,
          userTo: bob,
        },
      ],
      referenceThreads: [
        {
          _id: 'reference-1',
          reference: 'yes',
          userFrom: alice,
          userTo: bob,
        },
      ],
    });

    render(<AdminMessages />);

    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(mockedMessagesApi.getMessages).toHaveBeenCalledWith(user1, user2);
    expect(screen.getByText('Thread votes')).toBeInTheDocument();
    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(screen.getByText('Not seen')).toBeInTheDocument();
    expect(screen.getByText('2025-03-04 05:06')).toBeInTheDocument();
    expect(screen.getByText('Times in UTC.')).toBeInTheDocument();
    expect(screen.queryByText('Database entry')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?username1=alice&username2=bob');
  });

  it('resolves legacy ID links and replaces them with canonical username links', async () => {
    window.history.pushState(
      {},
      '',
      `/admin/messages?userId1=${user1}&userId2=${user2}`,
    );
    mockedUsersApi.getUser
      .mockResolvedValueOnce({
        profile: {
          _id: user1,
          username: alice.username,
          displayName: alice.displayName,
        },
      })
      .mockResolvedValueOnce({
        profile: {
          _id: user2,
          username: bob.username,
          displayName: bob.displayName,
        },
      });
    mockedMessagesApi.getMessages.mockResolvedValueOnce([]);

    render(<AdminMessages />);

    await waitFor(() =>
      expect(mockedMessagesApi.getMessages).toHaveBeenCalledWith(user1, user2),
    );
    expect(mockedUsersApi.getUser).toHaveBeenNthCalledWith(1, user1);
    expect(mockedUsersApi.getUser).toHaveBeenNthCalledWith(2, user2);
    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
    expect(window.location.search).toBe('?username1=alice&username2=bob');
  });

  it('prioritises usernames when both old and canonical query parameters exist', async () => {
    window.history.pushState(
      {},
      '',
      `/admin/messages?userId1=${user2}&userId2=${user1}&username1=alice&username2=bob`,
    );
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce([alice])
      .mockResolvedValueOnce([bob]);
    mockedMessagesApi.getMessages.mockResolvedValueOnce([]);

    render(<AdminMessages />);

    await waitFor(() =>
      expect(mockedMessagesApi.getMessages).toHaveBeenCalledWith(user1, user2),
    );
    expect(mockedUsersApi.getUser).not.toHaveBeenCalled();
  });

  it('shows an empty state when a username cannot be resolved', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/messages?username1=missing&username2=bob',
    );
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([bob]);

    render(<AdminMessages />);

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
    expect(mockedMessagesApi.getMessages).not.toHaveBeenCalled();
  });

  it('handles invalid legacy IDs and members that are no longer available', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/messages?userId1=invalid-id&userId2=222222222222222222222222',
    );
    mockedUsersApi.getUser.mockResolvedValueOnce(null);

    render(<AdminMessages />);

    expect(await screen.findByText('Nothing found…')).toBeVisible();
    expect(mockedUsersApi.getUser).toHaveBeenCalledTimes(1);
    expect(mockedUsersApi.getUser).toHaveBeenCalledWith(user2);
    expect(mockedMessagesApi.getMessages).not.toHaveBeenCalled();
  });

  it('reports message lookup failures separately from empty conversations', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/messages?username1=alice&username2=bob',
    );
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce([alice])
      .mockResolvedValueOnce([bob]);
    mockedMessagesApi.getMessages.mockRejectedValueOnce(new Error('failed'));

    render(<AdminMessages />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load conversation.',
    );
    expect(screen.queryByText('Nothing found…')).not.toBeInTheDocument();
  });

  it('renders deleted senders and safely displays malformed timestamps', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/messages?username1=alice&username2=bob',
    );
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce([alice])
      .mockResolvedValueOnce([bob]);
    mockedMessagesApi.getMessages.mockResolvedValueOnce([
      {
        _id: 'message-deleted',
        content: '<p>Message from a deleted member</p>',
        created: 'not-a-date',
        read: true,
        userFrom: { _id: 'deleted-user' },
        userTo: bob,
      },
    ]);

    render(<AdminMessages />);

    expect(
      await screen.findByText('Message from a deleted member'),
    ).toBeVisible();
    expect(screen.getAllByText('Unknown member')).toHaveLength(2);
    expect(screen.getByText('—')).toBeVisible();
    expect(screen.getByText('Seen')).toBeVisible();
  });

  it('resolves hex-shaped usernames as usernames and encodes them in the canonical URL', async () => {
    const hexUsername = 'abcdefabcdefabcdefabcdef';
    const hexUser = {
      ...alice,
      _id: '333333333333333333333333',
      username: hexUsername,
    };
    window.history.pushState(
      {},
      '',
      `/admin/messages?username1=${hexUsername}&username2=bob`,
    );
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce([hexUser])
      .mockResolvedValueOnce([bob]);
    mockedMessagesApi.getMessages.mockResolvedValueOnce([]);

    render(<AdminMessages />);

    await waitFor(() =>
      expect(mockedMessagesApi.getMessages).toHaveBeenCalledWith(
        hexUser._id,
        user2,
      ),
    );
    expect(mockedUsersApi.getUser).not.toHaveBeenCalled();
    expect(window.location.search).toBe(
      `?username1=${hexUsername}&username2=bob`,
    );
  });

  it('decodes and re-encodes usernames containing reserved URL characters', async () => {
    const encodedUsername = 'alice+helper';
    const specialUser = { ...alice, username: encodedUsername };
    window.history.pushState(
      {},
      '',
      `/admin/messages?username1=${encodeURIComponent(encodedUsername)}&username2=bob`,
    );
    mockedUsersApi.searchUsers
      .mockResolvedValueOnce([specialUser])
      .mockResolvedValueOnce([bob]);
    mockedMessagesApi.getMessages.mockResolvedValueOnce([]);

    render(<AdminMessages />);

    await waitFor(() =>
      expect(mockedUsersApi.searchUsers).toHaveBeenCalledWith(encodedUsername),
    );
    expect(await screen.findByText('Nothing found…')).toBeVisible();
    expect(window.location.search).toBe(
      `?username1=${encodeURIComponent(encodedUsername)}&username2=bob`,
    );
  });

  it('does not update the URL when a legacy lookup resolves after unmount', async () => {
    let resolveUser!: (user: MemberFixture) => void;
    mockedUsersApi.getUser.mockReturnValueOnce(
      new Promise(resolve => {
        resolveUser = resolve;
      }),
    );
    window.history.pushState(
      {},
      '',
      `/admin/messages?userId1=${user1}&userId2=${user2}`,
    );

    const view = render(<AdminMessages />);
    view.unmount();
    resolveUser({
      ...alice,
      profile: {
        _id: user1,
        username: alice.username,
        displayName: alice.displayName,
      },
    } as MemberFixture);
    await waitFor(() => expect(mockedUsersApi.getUser).toHaveBeenCalled());

    expect(window.location.search).toBe(`?userId1=${user1}&userId2=${user2}`);
    expect(mockedMessagesApi.getMessages).not.toHaveBeenCalled();
  });

  it('omits manual query and scammer warning controls', () => {
    render(<AdminMessages />);

    expect(
      screen.queryByRole('button', { name: 'Read' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Member 1 username or ID'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Warn scammer recipients'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Open a conversation from a member or reference page.'),
    ).toBeVisible();
    expect(mockedMessagesApi.getMessages).not.toHaveBeenCalled();
  });
});

test('resolves usernames from the paginated member search response', async () => {
  window.history.replaceState(
    {},
    '',
    '/admin/messages?username1=alice&username2=bob',
  );
  mockedUsersApi.searchUsers.mockResolvedValue({ users: [alice, bob] });
  mockedMessagesApi.getMessages.mockResolvedValue([]);
  render(<AdminMessages />);
  await screen.findByText('Nothing found…');
  expect(mockedMessagesApi.getMessages).toHaveBeenCalledWith(user1, user2);
});

test('handles member-search responses without results', async () => {
  window.history.replaceState(
    {},
    '',
    '/admin/messages?username1=alice&username2=bob',
  );
  mockedUsersApi.searchUsers.mockResolvedValue({});
  render(<AdminMessages />);
  expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  expect(mockedMessagesApi.getMessages).not.toHaveBeenCalled();
});

test('retains a legacy conversation when deleted account metadata has no username', async () => {
  window.history.replaceState(
    {},
    '',
    `/admin/messages?userId1=${user1}&userId2=${user2}`,
  );
  mockedUsersApi.getUser.mockResolvedValue({});
  mockedMessagesApi.getMessages.mockResolvedValue({});
  render(<AdminMessages />);
  await screen.findByText('Nothing found…');
  expect(mockedMessagesApi.getMessages).toHaveBeenCalledWith(user1, user2);
  expect(window.location.search).toBe(`?userId1=${user1}&userId2=${user2}`);
});

test('shows sender-name fallbacks and separates replies from the first participant', async () => {
  window.history.replaceState(
    {},
    '',
    '/admin/messages?username1=alice&username2=bob',
  );
  mockedUsersApi.searchUsers.mockResolvedValue([alice, bob]);
  mockedMessagesApi.getMessages.mockResolvedValue({
    messages: [
      {
        _id: 'first',
        userFrom: alice,
        userTo: bob,
        content: 'Initial message',
        created: 0,
        read: true,
      },
      {
        _id: 'reply',
        userFrom: { _id: user2, username: 'bob' },
        userTo: alice,
        content: 'Reply with no display name',
        created: new Date('2025-03-04T05:06:00Z'),
        read: false,
      },
      {
        _id: 'legacy',
        userFrom: { _id: 'deleted', displayName: 'Former display name' },
        content: 'Reply from deleted profile',
        created: null,
      },
      {
        _id: 'unknown',
        userFrom: undefined,
        content: 'Reply without sender metadata',
        created: undefined,
      },
    ],
  });
  render(<AdminMessages />);
  expect(await screen.findByText('1970-01-01 00:00')).toBeInTheDocument();
  expect(
    screen.getByText('Reply with no display name').closest('.message'),
  ).toHaveClass('message-sender-other');
  expect(screen.getByText('Former display name')).toBeInTheDocument();
  expect(screen.getByText('Unknown member')).toBeInTheDocument();
});

test.each([false, true])(
  'ignores a late conversation response after unmount (failure: %s)',
  async fail => {
    window.history.replaceState(
      {},
      '',
      '/admin/messages?username1=alice&username2=bob',
    );
    mockedUsersApi.searchUsers.mockResolvedValue([alice, bob]);
    let resolve!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    mockedMessagesApi.getMessages.mockImplementation(
      () =>
        new Promise((done, failure) => {
          resolve = done;
          reject = failure;
        }),
    );
    const view = render(<AdminMessages />);
    await waitFor(() =>
      expect(mockedMessagesApi.getMessages).toHaveBeenCalled(),
    );
    view.unmount();
    await act(async () => {
      if (fail) reject(new Error('Unavailable'));
      else resolve({ messages: [] });
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

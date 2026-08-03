import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import * as messagesApi from '@/modules/admin/client/api/messages.api';
import * as usersApi from '@/modules/admin/client/api/users.api';

jest.mock('@/modules/admin/client/api/messages.api');
jest.mock('@/modules/admin/client/api/users.api');
jest.mock('@/modules/core/client/components/TimeAgo', () => {
  const React = require('react');

  function MockTimeAgo({ date }) {
    return <time>{date.toISOString()}</time>;
  }

  MockTimeAgo.propTypes = {
    date: () => null,
  };

  return MockTimeAgo;
});

afterEach(() => {
  jest.resetAllMocks();
  window.history.pushState({}, '', '/');
});

const user1 = '111111111111111111111111';
const user2 = '222222222222222222222222';

const alice = {
  _id: user1,
  displayName: 'Alice Example',
  username: 'alice',
};

const bob = {
  _id: user2,
  displayName: 'Bob Example',
  username: 'bob',
};

describe('<AdminMessages />', () => {
  it('previews scammer recipients and sends the warning', async () => {
    messagesApi.getScammerRecipients.mockResolvedValueOnce({
      scammer: { username: 'reported-member' },
      recipients: [alice, bob],
    });
    messagesApi.sendScammerWarning.mockResolvedValueOnce({ sent: 2 });

    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Scammer username'), {
      target: { value: 'reported-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show recipients' }));

    const warningMessage = await screen.findByLabelText('Warning message');
    expect(warningMessage.closest('form')).toHaveTextContent(
      '2 recipient(s) found for @reported-member.',
    );
    expect(screen.getByText('alice (Alice Example)')).toBeInTheDocument();
    expect(screen.getByText('bob (Bob Example)')).toBeInTheDocument();
    fireEvent.change(warningMessage, {
      target: { value: 'Please ignore the earlier message.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send warning to all' }),
    );

    await waitFor(() =>
      expect(messagesApi.sendScammerWarning).toHaveBeenCalledWith(
        'reported-member',
        'Please ignore the earlier message.',
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          (_, element) =>
            element.tagName === 'P' &&
            element.textContent === 'Sent 2 warning message(s).',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('shows an empty recipient preview without a send form', async () => {
    messagesApi.getScammerRecipients.mockResolvedValueOnce({
      scammer: { username: 'quiet-member' },
      recipients: [],
    });

    render(<AdminMessages />);
    fireEvent.change(screen.getByLabelText('Scammer username'), {
      target: { value: 'quiet-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show recipients' }));

    await waitFor(() =>
      expect(messagesApi.getScammerRecipients).toHaveBeenCalledWith(
        'quiet-member',
      ),
    );
    expect(
      screen.getByText(
        (_, element) =>
          element.tagName === 'P' &&
          element.textContent === '0 recipient(s) found for @quiet-member.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Warning message')).not.toBeInTheDocument();
  });

  it('requires a fresh preview after the username changes', async () => {
    messagesApi.getScammerRecipients.mockResolvedValueOnce({
      scammer: { username: 'reported-member' },
      recipients: [alice],
    });

    render(<AdminMessages />);
    const username = screen.getByLabelText('Scammer username');
    fireEvent.change(username, { target: { value: 'reported-member' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show recipients' }));
    await screen.findByLabelText('Warning message');

    fireEvent.change(username, { target: { value: 'different-member' } });

    expect(screen.queryByLabelText('Warning message')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Send warning to all' }),
    ).not.toBeInTheDocument();
  });

  it('shows recipient lookup errors from the API', async () => {
    messagesApi.getScammerRecipients.mockRejectedValueOnce({
      response: { data: { message: 'Member does not exist.' } },
    });

    render(<AdminMessages />);
    fireEvent.change(screen.getByLabelText('Scammer username'), {
      target: { value: 'missing-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show recipients' }));

    expect(
      await screen.findByText('Member does not exist.'),
    ).toBeInTheDocument();
  });

  it('shows the fallback error when recipient lookup fails unexpectedly', async () => {
    messagesApi.getScammerRecipients.mockRejectedValueOnce(new Error('failed'));

    render(<AdminMessages />);
    fireEvent.change(screen.getByLabelText('Scammer username'), {
      target: { value: 'reported-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show recipients' }));

    expect(
      await screen.findByText('Could not find that member.'),
    ).toBeInTheDocument();
  });

  it('shows the fallback error when warning delivery fails', async () => {
    messagesApi.getScammerRecipients.mockResolvedValueOnce({
      scammer: { username: 'reported-member' },
      recipients: [alice],
    });
    messagesApi.sendScammerWarning.mockRejectedValueOnce(new Error('failed'));

    render(<AdminMessages />);
    fireEvent.change(screen.getByLabelText('Scammer username'), {
      target: { value: 'reported-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show recipients' }));
    await screen.findByLabelText('Warning message');
    fireEvent.click(
      screen.getByRole('button', { name: 'Send warning to all' }),
    );

    expect(
      await screen.findByText('Could not send the warning.'),
    ).toBeInTheDocument();
  });

  it('keeps the read action disabled until both members are present', () => {
    render(<AdminMessages />);

    const readButton = screen.getByRole('button', { name: 'Read' });

    expect(readButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Member 1 username or ID'), {
      target: { value: 'alice' },
    });

    expect(readButton).toBeDisabled();
    expect(messagesApi.getMessages).not.toHaveBeenCalled();
  });

  it('does not query when an invalid form submit bypasses the disabled read button', () => {
    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Member 1 username or ID'), {
      target: { value: user1 },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Read' }).closest('form'),
    );

    expect(messagesApi.getMessages).not.toHaveBeenCalled();
  });

  it('fetches and renders messages between two valid members', async () => {
    messagesApi.getMessages.mockResolvedValueOnce({
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
        {
          _id: 'reference-2',
          reference: 'no',
          userFrom: bob,
          userTo: alice,
        },
      ],
    });

    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Member 1 username or ID'), {
      target: { value: user1 },
    });
    fireEvent.change(screen.getByLabelText('Member 2 username or ID'), {
      target: { value: user2 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));

    await waitFor(() =>
      expect(messagesApi.getMessages).toHaveBeenCalledWith(user1, user2),
    );
    expect(
      screen.getByText('Messaging between', { exact: false }),
    ).toHaveTextContent(
      'Messaging between alice (Alice Example) & bob (Bob Example)',
    );
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Database entry')).toBeInTheDocument();
    expect(
      screen.getByText('Database entry').closest('.panel-body'),
    ).toHaveTextContent('Not seen.');
    expect(screen.getByText('Thread votes')).toBeInTheDocument();
    expect(screen.getByText('positive')).toHaveClass('text-success');
    expect(screen.getByText('negative')).toHaveClass('text-danger');
    expect(
      screen.getByText('Thread votes').closest('.alert'),
    ).toHaveTextContent(
      'alice (Alice Example) voted positive for bob (Bob Example)',
    );
    expect(
      screen.getByText('Thread votes').closest('.alert'),
    ).toHaveTextContent(
      'bob (Bob Example) voted negative for alice (Alice Example)',
    );
  });

  it('resolves usernames before fetching messages', async () => {
    usersApi.searchUsers
      .mockResolvedValueOnce([alice])
      .mockResolvedValueOnce([bob]);
    messagesApi.getMessages.mockResolvedValueOnce([
      {
        _id: 'message-1',
        content: '<p>Hello by username</p>',
        created: '2025-03-04T05:06:07.000Z',
        read: true,
        userFrom: alice,
        userTo: bob,
      },
    ]);

    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Member 1 username or ID'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText('Member 2 username or ID'), {
      target: { value: 'bob' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));

    await waitFor(() =>
      expect(usersApi.searchUsers).toHaveBeenCalledWith('alice'),
    );
    expect(usersApi.searchUsers).toHaveBeenCalledWith('bob');
    await waitFor(() =>
      expect(messagesApi.getMessages).toHaveBeenCalledWith(user1, user2),
    );
    expect(await screen.findByText('Hello by username')).toBeInTheDocument();
  });

  it('shows an empty state when a username cannot be resolved', async () => {
    usersApi.searchUsers.mockResolvedValueOnce([]);

    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Member 1 username or ID'), {
      target: { value: 'missing' },
    });
    fireEvent.change(screen.getByLabelText('Member 2 username or ID'), {
      target: { value: user2 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
    expect(messagesApi.getMessages).not.toHaveBeenCalled();
  });

  it('renders read messages as seen', async () => {
    messagesApi.getMessages.mockResolvedValueOnce([
      {
        _id: 'message-1',
        content: '<p>Hello Alice</p>',
        created: '2025-03-04T05:06:07.000Z',
        read: true,
        userFrom: alice,
        userTo: bob,
      },
    ]);

    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Member 1 username or ID'), {
      target: { value: user1 },
    });
    fireEvent.change(screen.getByLabelText('Member 2 username or ID'), {
      target: { value: user2 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));

    expect(await screen.findByText('Database entry')).toBeInTheDocument();
    expect(
      screen.getByText('Database entry').closest('.panel-body'),
    ).toHaveTextContent('Seen.');
  });

  it('shows an empty state after a valid query with no messages', async () => {
    window.history.pushState(
      {},
      '',
      `/admin/messages?userId1=${user1}&userId2=${user2}`,
    );
    messagesApi.getMessages.mockResolvedValueOnce([]);

    render(<AdminMessages />);

    await waitFor(() =>
      expect(messagesApi.getMessages).toHaveBeenCalledWith(user1, user2),
    );
    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  });

  it('treats object responses without messages as empty results', async () => {
    messagesApi.getMessages.mockResolvedValueOnce({});

    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Member 1 username or ID'), {
      target: { value: user1 },
    });
    fireEvent.change(screen.getByLabelText('Member 2 username or ID'), {
      target: { value: user2 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  });
});

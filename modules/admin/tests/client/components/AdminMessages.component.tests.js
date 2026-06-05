import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import * as messagesApi from '@/modules/admin/client/api/messages.api';

jest.mock('@/modules/admin/client/api/messages.api');
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
  jest.clearAllMocks();
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
  it('keeps the read action disabled until both member ids are valid', () => {
    render(<AdminMessages />);

    const readButton = screen.getByRole('button', { name: 'Read' });

    expect(readButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Member 1 ID'), {
      target: { value: user1 },
    });

    expect(readButton).toBeDisabled();
    expect(messagesApi.getMessages).not.toHaveBeenCalled();
  });

  it('fetches and renders messages between two valid members', async () => {
    messagesApi.getMessages.mockResolvedValueOnce([
      {
        _id: 'message-1',
        content: '<p>Hello <strong>Bob</strong></p>',
        created: '2025-03-04T05:06:07.000Z',
        read: false,
        userFrom: alice,
        userTo: bob,
      },
    ]);

    render(<AdminMessages />);

    fireEvent.change(screen.getByLabelText('Member 1 ID'), {
      target: { value: user1 },
    });
    fireEvent.change(screen.getByLabelText('Member 2 ID'), {
      target: { value: user2 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));

    await waitFor(() =>
      expect(messagesApi.getMessages).toHaveBeenCalledWith(user1, user2),
    );
    expect(
      screen.getByText('Messaging between', { exact: false }),
    ).toHaveTextContent('Messaging between Alice Example & Bob Example');
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Database entry')).toBeInTheDocument();
    expect(
      screen.getByText('Database entry').closest('.panel-body'),
    ).toHaveTextContent('Not seen.');
  });

  it('shows an empty state after a valid query with no messages', async () => {
    window.history.pushState(
      {},
      '',
      `/admin/messages?userId1=${user1}&userId2=${user2}`,
    );
    messagesApi.getMessages.mockResolvedValueOnce([]);

    render(<AdminMessages />);

    expect(screen.getByText('Press "Read"')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read' }));

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  });
});

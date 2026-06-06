import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import * as threadsApi from '@/modules/admin/client/api/threads.api';

jest.mock('@/modules/admin/client/api/threads.api');
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

const originalAlert = window.alert;

afterEach(() => {
  jest.clearAllMocks();
  window.alert = originalAlert;
  window.history.pushState({}, '', '/');
});

const userId = '111111111111111111111111';

const makeUser = overrides => ({
  _id: '222222222222222222222222',
  displayName: 'Bob Example',
  username: 'bob',
  ...overrides,
});

describe('<AdminThreads />', () => {
  it('uses a valid member id from the URL as the initial query', () => {
    window.history.pushState({}, '', `/admin/threads?userId=${userId}`);

    render(<AdminThreads />);

    expect(screen.getByLabelText('Member ID')).toHaveValue(userId);
    expect(screen.getByText('Press "Query"')).toBeInTheDocument();
  });

  it('alerts instead of querying when a member id has the wrong length', () => {
    window.alert = jest.fn();

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Member ID'), {
      target: { value: 'short-id' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(window.alert).toHaveBeenCalledWith('User ID is wrong length');
    expect(threadsApi.getThreads).not.toHaveBeenCalled();
  });

  it('queries by username and renders thread state and links', async () => {
    threadsApi.getThreads.mockResolvedValueOnce([
      {
        _id: 'thread-1',
        read: false,
        updated: '2025-04-05T06:07:08.000Z',
        userFromProfile: [makeUser({ displayName: 'Alice Example' })],
        userToProfile: [makeUser({ _id: userId, displayName: 'Bob Example' })],
      },
    ]);

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    await waitFor(() =>
      expect(threadsApi.getThreads).toHaveBeenCalledWith({
        userId: '',
        username: 'alice',
      }),
    );
    expect(screen.getByText('Messages from/to them')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toHaveClass('label-warning');
    expect(screen.getByRole('link', { name: 'Read thread' })).toHaveAttribute(
      'href',
      `/admin/messages?userId1=222222222222222222222222&userId2=${userId}`,
    );
  });

  it('renders read threads with success state', async () => {
    threadsApi.getThreads.mockResolvedValueOnce([
      {
        _id: 'thread-1',
        read: true,
        updated: '2025-04-05T06:07:08.000Z',
        userFromProfile: [makeUser({ displayName: 'Alice Example' })],
        userToProfile: [makeUser({ _id: userId, displayName: 'Bob Example' })],
      },
    ]);

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(await screen.findByText('Read')).toHaveClass('label-success');
  });

  it('shows an empty state after a query with no threads', async () => {
    threadsApi.getThreads.mockResolvedValueOnce([]);

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  });

  it('shows an empty state when the thread query returns no payload', async () => {
    threadsApi.getThreads.mockResolvedValueOnce(null);

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  });
});

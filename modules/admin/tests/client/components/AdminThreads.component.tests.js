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

afterEach(() => {
  jest.clearAllMocks();
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

    expect(screen.getByLabelText('Member username or ID')).toHaveValue(userId);
    expect(screen.queryByText('Press "Query"')).not.toBeInTheDocument();
  });

  it('uses a username from the URL as the initial query', () => {
    window.history.pushState({}, '', '/admin/threads?username=alice');

    render(<AdminThreads />);

    expect(screen.getByLabelText('Member username or ID')).toHaveValue('alice');
    expect(screen.queryByText('Press "Query"')).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Member username or ID'), {
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

  it('queries by member id from the single input', async () => {
    threadsApi.getThreads.mockResolvedValueOnce([]);

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Member username or ID'), {
      target: { value: userId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    await waitFor(() =>
      expect(threadsApi.getThreads).toHaveBeenCalledWith({
        userId,
        username: '',
      }),
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

    fireEvent.change(screen.getByLabelText('Member username or ID'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(await screen.findByText('Read')).toHaveClass('label-success');
  });

  it('shows an empty state after a query with no threads', async () => {
    threadsApi.getThreads.mockResolvedValueOnce([]);

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Member username or ID'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  });

  it('shows an empty state when the thread query returns no payload', async () => {
    threadsApi.getThreads.mockResolvedValueOnce(null);

    render(<AdminThreads />);

    fireEvent.change(screen.getByLabelText('Member username or ID'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(await screen.findByText('Nothing found…')).toBeInTheDocument();
  });
});

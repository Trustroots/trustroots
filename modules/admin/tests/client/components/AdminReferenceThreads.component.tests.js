import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminReferenceThreads from '@/modules/admin/client/components/AdminReferenceThreads.component';
import * as referenceThreadsApi from '@/modules/admin/client/api/admin-reference-threads.api';

jest.mock('@/modules/admin/client/api/admin-reference-threads.api');
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
  jest.restoreAllMocks();
});

const userFrom = {
  _id: '111111111111111111111111',
  displayName: 'Alice Sender',
  username: 'alice',
};

const userTo = {
  _id: '222222222222222222222222',
  displayName: 'Bob Receiver',
  username: 'bob',
};

describe('<AdminReferenceThreads />', () => {
  it('loads and renders negative reference threads', async () => {
    referenceThreadsApi.getReferenceThreads.mockResolvedValueOnce([
      {
        _id: 'reference-thread-1',
        created: '2025-06-07T08:09:10.000Z',
        userFrom,
        userTo,
      },
    ]);

    render(<AdminReferenceThreads />);

    expect(
      screen.getByText('Loading reference threads...'),
    ).toBeInTheDocument();
    expect(await screen.findByText('alice (Alice Sender)')).toHaveAttribute(
      'href',
      `/admin/user?id=${userFrom._id}`,
    );
    expect(screen.getByText('bob (Bob Receiver)')).toHaveAttribute(
      'href',
      `/admin/user?id=${userTo._id}`,
    );
    expect(screen.getByRole('link', { name: 'See messages' })).toHaveAttribute(
      'href',
      `/admin/messages?userId1=${userTo._id}&userId2=${userFrom._id}`,
    );
  });

  it('renders top negative recipients', async () => {
    referenceThreadsApi.getReferenceThreads.mockResolvedValueOnce({
      items: [
        {
          _id: 'reference-thread-1',
          created: '2025-06-07T08:09:10.000Z',
          userFrom,
          userTo,
        },
      ],
      topNegativeRecipients: [
        { count: 7, user: userTo },
        { count: 3, user: userFrom._id },
      ],
    });

    render(<AdminReferenceThreads />);

    expect(await screen.findByText('Top score')).toBeInTheDocument();
    expect(screen.getByText('7')).toHaveClass('label-danger');
    expect(screen.getAllByText('bob (Bob Receiver)')[0]).toHaveAttribute(
      'href',
      `/admin/user?id=${userTo._id}`,
    );
    expect(screen.getByText('3')).toHaveClass('label-danger');
    expect(screen.getAllByText('Unknown member')[0]).toBeInTheDocument();
  });

  it('builds message-thread links when reference users are raw ids', async () => {
    referenceThreadsApi.getReferenceThreads.mockResolvedValueOnce([
      {
        _id: 'reference-thread-2',
        created: '2025-06-07T08:09:10.000Z',
        userFrom: userFrom._id,
        userTo: userTo._id,
      },
    ]);

    render(<AdminReferenceThreads />);

    expect(
      await screen.findByRole('link', { name: 'See messages' }),
    ).toHaveAttribute(
      'href',
      `/admin/messages?userId1=${userTo._id}&userId2=${userFrom._id}`,
    );
    expect(screen.getAllByText('Unknown member')).toHaveLength(2);
  });

  it('defaults missing top negative recipients to an empty list', async () => {
    referenceThreadsApi.getReferenceThreads.mockResolvedValueOnce({
      items: [],
    });

    render(<AdminReferenceThreads />);

    await waitFor(() =>
      expect(
        screen.queryByText('Loading reference threads...'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Top score')).not.toBeInTheDocument();
  });

  it('logs and clears loading state when loading fails', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    referenceThreadsApi.getReferenceThreads.mockRejectedValueOnce(
      new Error('failed'),
    );

    render(<AdminReferenceThreads />);

    await waitFor(() =>
      expect(log).toHaveBeenCalledWith('Could not load reference threads'),
    );
    expect(
      screen.queryByText('Loading reference threads...'),
    ).not.toBeInTheDocument();
  });
});

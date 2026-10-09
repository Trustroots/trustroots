import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import Admin from '@/modules/admin/client/components/Admin.component';
import * as dashboardApi from '@/modules/admin/client/api/admin-dashboard.api';
import * as usersApi from '@/modules/admin/client/api/users.api';
import type { AdminDashboard } from '@/modules/admin/client/api/admin-dashboard.api';

jest.mock('@/modules/admin/client/api/admin-dashboard.api');
jest.mock('@/modules/admin/client/api/users.api');
const mockedDashboardApi = jest.mocked(dashboardApi);
const mockedUsersApi = jest.mocked(usersApi);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

type MalformedDashboardFixture = {
  negativeExperiences?: Array<{
    _id: string;
    created?: string;
    feedbackPublic?: string | null;
    userFrom?: { _id?: string; displayName?: string; username?: string } | null;
    userTo?: { _id?: string; displayName?: string; username?: string } | null;
  }>;
  threadVotes?: Array<{
    _id?: string;
    created?: string;
    thread?: string;
    userFrom?: { _id?: string; displayName?: string; username?: string } | null;
    userTo?: { _id?: string; displayName?: string; username?: string } | null;
  }>;
  topMessengers?: Array<{
    messageCount: number;
    user?: { _id?: string; displayName?: string; username?: string } | null;
  }>;
};

function malformedDashboardResponse(
  response: MalformedDashboardFixture,
): AdminDashboard {
  // These fixtures deliberately model absent/invalid fields from the API boundary.
  return response as unknown as AdminDashboard;
}

afterEach(() => {
  jest.clearAllMocks();
  window.history.pushState({}, '', '/');
});

describe('<Admin />', () => {
  beforeEach(() => {
    mockedDashboardApi.getAdminDashboard.mockResolvedValue({
      negativeExperiences: [
        {
          _id: 'experience-1',
          created: '2026-06-21T12:00:00.000Z',
          feedbackPublic: 'A generous welcome.\nA useful follow-up.',
          userFrom: {
            _id: 'experience-from-1',
            displayName: 'Experience sender',
            username: 'experience-sender',
          },
          userTo: {
            _id: 'experience-to-1',
            displayName: 'Experience receiver',
            username: 'experience-receiver',
          },
        },
      ],
      threadVotes: [
        {
          _id: 'review-1',
          created: '2026-06-20T12:00:00.000Z',
          thread: 'thread-1',
          userFrom: {
            _id: 'user-from-1',
            displayName: 'Sender',
            username: 'sender',
          },
          userTo: {
            _id: 'user-to-1',
            displayName: 'Receiver',
            username: 'receiver',
          },
        },
      ],
      topMessengers: [
        {
          messageCount: 12,
          user: {
            _id: 'user-1',
            displayName: 'Alice',
            username: 'alice',
          },
        },
      ],
    });
  });

  it('renders dashboard activity without the old workflow link boxes', async () => {
    window.history.pushState({}, '', '/admin');
    render(<Admin />);

    expect(screen.queryByText(/Welcome, friend!/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Team Guide' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Search members' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Name, username or email'),
    ).toBeInTheDocument();

    [
      'Members',
      'Moderation',
      'Community/admin tools',
      'External tools',
    ].forEach(heading => {
      expect(
        screen.queryByRole('heading', { name: heading }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole('link', { name: 'Search members' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Member report card' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Remember to logout on public computers!'),
    ).not.toBeInTheDocument();
    expect(mockedUsersApi.searchUsers).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', {
        name: 'Top 10 Messengers Last Week',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('12 messages')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Last 10 Negative Thread Votes',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'sender (Sender)' }),
    ).toHaveAttribute('href', '/admin/user/sender');
    expect(
      screen.getByRole('heading', { name: 'Last 10 Negative Experiences' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'experience-sender (Experience sender)',
      }),
    ).toHaveAttribute('href', '/admin/user/experience-sender');
    expect(screen.getByText('2026-06-21')).toBeInTheDocument();
    const feedbackTrigger = screen.getByRole('button', {
      name: 'Preview public feedback from 2026-06-21',
    });
    fireEvent.focus(feedbackTrigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      /A generous welcome\.\s+A useful follow-up\./,
    );
  });

  it('shows an error when dashboard activity cannot be loaded', async () => {
    mockedDashboardApi.getAdminDashboard.mockRejectedValueOnce(
      new Error('failed'),
    );

    render(<Admin />);

    expect(
      await screen.findByText('Could not load dashboard activity.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No messages last week.')).toBeInTheDocument();
    expect(
      screen.getByText('No negative thread votes found.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No negative experiences found.'),
    ).toBeInTheDocument();
  });

  it('renders dashboard rows with missing optional data', async () => {
    mockedDashboardApi.getAdminDashboard.mockResolvedValueOnce(
      malformedDashboardResponse({
        negativeExperiences: [
          {
            _id: 'experience-without-date',
            created: 'not-a-date',
            userFrom: null,
            userTo: null,
          },
        ],
        threadVotes: [
          {
            _id: 'review-with-thread',
            thread: 'thread-without-users',
          },
          {
            _id: 'review-with-invalid-date',
            created: 'not-a-date',
            thread: 'thread-with-invalid-date',
            userFrom: {
              displayName: 'Missing ID sender',
            },
            userTo: {
              _id: 'user-to-2',
              username: 'receiver-two',
            },
          },
          {
            _id: 'review-link-with-thread',
            created: 'not-a-date',
            thread: 'linked-thread-with-invalid-date',
            userFrom: {
              _id: 'user-from-2',
              username: 'sender-two',
            },
            userTo: {
              _id: 'user-to-3',
              username: 'receiver-three',
            },
          },
        ],
        topMessengers: [
          {
            messageCount: 1,
            user: null,
          },
        ],
      }),
    );

    render(<Admin />);

    expect(await screen.findByText('1 messages')).toBeInTheDocument();
    expect(await screen.findByText('thread-without-users')).toBeInTheDocument();
    expect(screen.getByText('thread-with-invalid-date')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'linked-thread-with-invalid-date' }),
    ).toHaveAttribute(
      'href',
      '/admin/messages?userId1=user-from-2&userId2=user-to-3',
    );
    expect(
      screen.queryByRole('link', { name: 'thread-without-users' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    fireEvent.focus(
      screen.getByRole('button', {
        name: 'Preview public feedback from Unknown date',
      }),
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Public feedback is unavailable.',
    );
  });

  it('uses empty dashboard lists when the API omits them', async () => {
    mockedDashboardApi.getAdminDashboard.mockResolvedValueOnce(
      malformedDashboardResponse({}),
    );

    render(<Admin />);

    expect(
      await screen.findByText('No messages last week.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No negative thread votes found.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No negative experiences found.'),
    ).toBeInTheDocument();
  });

  it('does not update dashboard state after an unmount', async () => {
    const pending = deferred<AdminDashboard>();
    mockedDashboardApi.getAdminDashboard.mockReturnValueOnce(pending.promise);

    const { unmount } = render(<Admin />);

    unmount();
    pending.resolve({
      negativeExperiences: [],
      threadVotes: [],
      topMessengers: [],
    });
    await pending.promise;

    expect(mockedDashboardApi.getAdminDashboard).toHaveBeenCalledTimes(1);
  });

  it('does not update dashboard error after an unmount', async () => {
    const pending = deferred<AdminDashboard>();
    mockedDashboardApi.getAdminDashboard.mockReturnValueOnce(pending.promise);

    const { unmount } = render(<Admin />);

    unmount();
    pending.reject(new Error('failed'));
    await expect(pending.promise).rejects.toThrow('failed');

    expect(mockedDashboardApi.getAdminDashboard).toHaveBeenCalledTimes(1);
  });
});

import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AccountActivity from '@/modules/users/client/components/AccountActivity.component';
import axios from '@/modules/core/client/api/http-client';

const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('@/modules/core/client/api/http-client');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('AccountActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: { events: [], nextCursor: null },
    });
  });

  it('renders event labels and refreshes the member history', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        events: [
          'session_created',
          'session_revoked',
          'sessions_signed_out',
          'password_changed',
          'password_reset',
          'email_changed',
          'mfa_enabled',
          'mfa_disabled',
          'recovery_codes_replaced',
          'recovery_code_used',
        ].map(eventType => ({
          eventType,
          createdAt: '2026-10-12T10:00:00.000Z',
        })),
        nextCursor: null,
      },
    });

    await act(async () => {
      render(<AccountActivity />);
    });
    expect(await screen.findByText('New session started')).toBeInTheDocument();
    expect(screen.getByText('A session was signed out')).toBeInTheDocument();
    expect(screen.getByText('Sessions signed out')).toBeInTheDocument();
    expect(screen.getByText('Password changed')).toBeInTheDocument();
    expect(screen.getByText('Password reset')).toBeInTheDocument();
    expect(screen.getByText('Email address changed')).toBeInTheDocument();
    expect(screen.getByText('Authenticator MFA enabled')).toBeInTheDocument();
    expect(screen.getByText('Authenticator MFA disabled')).toBeInTheDocument();
    expect(screen.getByText('Recovery codes replaced')).toBeInTheDocument();
    expect(screen.getByText('A recovery code was used')).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/users/activity', {
      params: undefined,
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: { events: [], nextCursor: null },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh activity' }));
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText('No recent account activity.'),
    ).toBeInTheDocument();
  });

  it('distinguishes an empty history from an unavailable history', async () => {
    await act(async () => {
      render(<AccountActivity />);
    });
    expect(
      await screen.findByText('No recent account activity.'),
    ).toBeInTheDocument();

    mockedAxios.get.mockRejectedValueOnce(new Error('unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh activity' }));
    expect(
      await screen.findByText('Could not load account activity. Try again.'),
    ).toBeInTheDocument();
  });

  it.each(['success', 'failure'])(
    'ignores a stale %s after refreshing',
    async outcome => {
      let resolveRequest!: (value: unknown) => void;
      let rejectRequest!: (error: Error) => void;
      const staleRequest = new Promise((resolve, reject) => {
        resolveRequest = resolve;
        rejectRequest = reject;
      });
      mockedAxios.get.mockImplementationOnce(() => staleRequest as never);
      await act(async () => {
        render(<AccountActivity />);
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Refresh activity' }),
        );
      });
      expect(
        await screen.findByText('No recent account activity.'),
      ).toBeInTheDocument();

      await act(async () => {
        if (outcome === 'failure') {
          rejectRequest(new Error('stale failure'));
        } else {
          resolveRequest({
            data: {
              events: [
                {
                  eventType: 'password_changed',
                  createdAt: '2026-10-12T10:00:00.000Z',
                },
              ],
              nextCursor: 'stale-cursor',
            },
          });
        }
      });
      expect(
        screen.getByText('No recent account activity.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Password changed')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Could not load account activity. Try again.'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Load more activity' }),
      ).not.toBeInTheDocument();
    },
  );

  it('loads the next page and reports pagination failures', async () => {
    let resolveNextPage: ((value: { data: unknown }) => void) | undefined;
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              eventType: 'password_changed',
              createdAt: '2026-10-12T10:00:00.000Z',
            },
          ],
          nextCursor: 'opaque-cursor',
        },
      })
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveNextPage = resolve;
          }) as never,
      );

    await act(async () => {
      render(<AccountActivity />);
    });
    await screen.findByText('Password changed');
    const loadMore = screen.getByRole('button', { name: 'Load more activity' });
    fireEvent.click(loadMore);
    expect(
      screen.getByRole('button', { name: 'Loading activity…' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Loading activity…' }));
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveNextPage?.({
        data: {
          events: [
            {
              eventType: 'password_reset',
              createdAt: '2026-10-11T10:00:00.000Z',
            },
          ],
          nextCursor: null,
        },
      });
    });
    expect(await screen.findByText('Password reset')).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, '/api/users/activity', {
      params: { cursor: 'opaque-cursor' },
    });
    expect(
      screen.queryByRole('button', { name: 'Load more activity' }),
    ).not.toBeInTheDocument();

    mockedAxios.get.mockReset();
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        events: [
          {
            eventType: 'email_changed',
            createdAt: '2026-10-12T10:00:00.000Z',
          },
        ],
        nextCursor: 'another-cursor',
      },
    });
    mockedAxios.get.mockRejectedValueOnce(new Error('unavailable'));
    let unmount: () => void = () => undefined;
    await act(async () => {
      ({ unmount } = render(<AccountActivity />));
    });
    await screen.findByText('Email address changed');
    fireEvent.click(screen.getByRole('button', { name: 'Load more activity' }));
    expect(
      await screen.findByText('Could not load account activity. Try again.'),
    ).toBeInTheDocument();
    unmount();
  });
});

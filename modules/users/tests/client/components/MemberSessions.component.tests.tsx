import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import MemberSessions from '@/modules/users/client/components/MemberSessions.component';
import axios from '@/modules/core/client/api/http-client';
import { navigate } from '@/modules/core/client/services/client-runtime';

const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('@/modules/core/client/api/http-client');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  navigate: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('MemberSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          id: 'a'.repeat(64),
          createdAt: '2026-10-08T10:00:00.000Z',
          lastSeenAt: '2026-10-08T10:01:00.000Z',
          current: true,
        },
        {
          id: 'b'.repeat(64),
          createdAt: '2026-10-07T10:00:00.000Z',
          lastSeenAt: '2026-10-07T10:01:00.000Z',
          current: false,
        },
      ],
    });
    mockedAxios.delete.mockResolvedValue({});
  });

  it('shows the current and other sessions and confirms a selected sign-out', async () => {
    render(<MemberSessions />);

    expect(await screen.findByText(/This session/)).toBeInTheDocument();
    expect(screen.getByText(/Another session/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password for session changes'), {
      target: { value: 'ExamplePassword123!' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Sign out this session' })[1],
    );

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        `/api/auth/sessions/${'b'.repeat(64)}`,
        { data: { password: 'ExamplePassword123!' } },
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Session signed out.',
    );
  });

  it('reports session list failures', async () => {
    mockedAxios.get.mockRejectedValue(new Error('unavailable'));
    render(<MemberSessions />);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Could not load your sessions.',
    );
  });

  it('reports mutation failures without discarding the password', async () => {
    mockedAxios.delete.mockRejectedValue(new Error('incorrect password'));
    render(<MemberSessions />);
    await screen.findByText(/This session/);
    fireEvent.change(screen.getByLabelText('Password for session changes'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out everywhere' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Could not sign out the session. Check your password and try again.',
    );
    expect(screen.getByLabelText('Password for session changes')).toHaveValue(
      'wrong-password',
    );
  });

  it('redirects to sign-in after signing out the current session', async () => {
    render(<MemberSessions />);
    await screen.findByText(/This session/);
    fireEvent.change(screen.getByLabelText('Password for session changes'), {
      target: { value: 'ExamplePassword123!' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Sign out this session' })[0],
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/signin', undefined, {
        reload: true,
      });
    });
  });

  it('redirects to sign-in after signing out everywhere', async () => {
    render(<MemberSessions />);
    await screen.findByText(/This session/);
    fireEvent.change(screen.getByLabelText('Password for session changes'), {
      target: { value: 'ExamplePassword123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out everywhere' }),
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/signin', undefined, {
        reload: true,
      });
    });
  });
});

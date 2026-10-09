import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ForgotPasswordPage from '@/modules/users/client/components/ForgotPasswordPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import * as clientRuntime from '@/modules/core/client/services/client-runtime';

type BoardProps = { children?: React.ReactNode };

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/core/client/components/Board', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children }: BoardProps) => <section>{children}</section>,
  };
});
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ userhandle: 'member-one' })),
}));

const forgotPassword = jest.mocked(authApi.forgotPassword);
const routeParams = jest.mocked(clientRuntime.getCurrentRouteParams);

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routeParams.mockReturnValue({ userhandle: 'member-one' });
  });

  it('prefills the username from route params and submits a reset request', async () => {
    forgotPassword.mockResolvedValue({ message: 'Sent.' });

    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText('Email or username')).toHaveValue(
      'member-one',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith({ username: 'member-one' });
    });

    expect(
      await screen.findByText(
        'If an account matches that username or email, we will send recovery instructions.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/look for it in your junk mail folder/i),
    ).toBeInTheDocument();
  });

  it('shows an error when the reset request fails', async () => {
    forgotPassword.mockRejectedValue({
      response: { data: { message: 'Unknown user.' } },
    });

    render(<ForgotPasswordPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(await screen.findByText('Unknown user.')).toBeInTheDocument();
  });

  it('keeps the form usable when the rejected value has no API message', async () => {
    // This malformed rejection verifies the component's error fallback.
    forgotPassword.mockRejectedValue(null);

    render(<ForgotPasswordPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Email or username')).toBeEnabled(),
    );
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])(
    'shows recovery guidance for %s without retrying the request',
    async code => {
      forgotPassword.mockRejectedValue({ code });

      render(<ForgotPasswordPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not confirm whether the recovery request completed. Check your inbox before trying again.',
      );
      expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
      expect(screen.getByLabelText('Email or username')).toHaveValue(
        'member-one',
      );
      expect(forgotPassword).toHaveBeenCalledTimes(1);
    },
  );

  it('updates the username before submitting', async () => {
    forgotPassword.mockResolvedValue({ message: 'Sent.' });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'new-member' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith({
        username: 'new-member',
      });
    });
  });

  it('starts with an empty username when no route handle is present', () => {
    routeParams.mockReturnValue({});

    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText('Email or username')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
  });
});

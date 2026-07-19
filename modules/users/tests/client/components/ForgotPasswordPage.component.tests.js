import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ForgotPasswordPage from '@/modules/users/client/components/ForgotPasswordPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/core/client/components/Board', () => ({
  __esModule: true,
  default: ({ children }) => <section>{children}</section>,
}));
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ userhandle: 'ada' })),
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefills the username from route params and submits a reset request', async () => {
    authApi.forgotPassword.mockResolvedValue({ message: 'Sent.' });

    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText('Email or username')).toHaveValue('ada');

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith({ username: 'ada' });
    });

    expect(
      screen.getByText('We sent you an email with further instructions.'),
    ).toBeInTheDocument();
  });

  it('shows an error when the reset request fails', async () => {
    authApi.forgotPassword.mockRejectedValue({
      response: { data: { message: 'Unknown user.' } },
    });

    render(<ForgotPasswordPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(await screen.findByText('Unknown user.')).toBeInTheDocument();
  });

  it('updates the username before submitting', async () => {
    authApi.forgotPassword.mockResolvedValue({ message: 'Sent.' });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'new-user' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith({
        username: 'new-user',
      });
    });
  });

  it('starts with an empty username when no route handle is present', () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({});

    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText('Email or username')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
  });
});

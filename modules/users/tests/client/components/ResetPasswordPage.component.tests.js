import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ResetPasswordPage from '@/modules/users/client/components/ResetPasswordPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import { applyAuthenticatedUser } from '@/modules/users/client/utils/auth';
import { navigate } from '@/modules/core/client/services/client-runtime';

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/users/client/utils/auth', () => ({
  ...jest.requireActual('@/modules/users/client/utils/auth'),
  applyAuthenticatedUser: jest.fn(),
}));
jest.mock('@/modules/core/client/components/Board', () => ({
  __esModule: true,
  default: ({ children }) => <section>{children}</section>,
}));
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ token: 'reset-token' })),
  navigate: jest.fn(),
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderPage() {
    return render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: null,
        }}
      >
        <ResetPasswordPage />
      </AppProviders>,
    );
  }

  async function fillPasswords(newPassword, verifyPassword) {
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: newPassword },
    });
    fireEvent.change(document.getElementById('verifyPassword'), {
      target: { value: verifyPassword },
    });

    await waitFor(() => {
      expect(document.getElementById('verifyPassword')).toHaveValue(
        verifyPassword,
      );
    });
  }

  async function submitForm() {
    fireEvent.submit(
      screen.getByRole('button', { name: 'Update Password' }).closest('form'),
    );
  }

  it('shows a validation error when passwords do not match', async () => {
    renderPage();

    await fillPasswords('password-one', 'password-two');
    await submitForm();

    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('resets the password and redirects on success', async () => {
    const user = { _id: 'user-1', username: 'ada' };
    authApi.resetPassword.mockResolvedValue(user);

    renderPage();

    await fillPasswords('new-password', 'new-password');
    await submitForm();

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith('reset-token', {
        newPassword: 'new-password',
        verifyPassword: 'new-password',
      });
    });

    expect(applyAuthenticatedUser).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('reset-success');
  });

  it('shows an error when the reset request fails', async () => {
    authApi.resetPassword.mockRejectedValue({
      response: { data: { message: 'Reset token expired.' } },
    });

    renderPage();

    await fillPasswords('new-password', 'new-password');
    await submitForm();

    expect(await screen.findByText('Reset token expired.')).toBeInTheDocument();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ResetPasswordPage from '@/modules/users/client/components/ResetPasswordPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import { applyAuthenticatedUser } from '@/modules/users/client/utils/auth';
import * as clientRuntime from '@/modules/core/client/services/client-runtime';

type BoardProps = { children?: React.ReactNode };

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/users/client/utils/auth', () => ({
  ...jest.requireActual('@/modules/users/client/utils/auth'),
  applyAuthenticatedUser: jest.fn(),
}));
jest.mock('@/modules/core/client/components/Board', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children }: BoardProps) => <section>{children}</section>,
  };
});
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: jest.fn(() => ({ token: 'reset-token' })),
  navigate: jest.fn(),
}));

const resetPassword = jest.mocked(authApi.resetPassword);
const navigate = jest.mocked(clientRuntime.navigate);
const applyUser = jest.mocked(applyAuthenticatedUser);

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

  function getVerifyPasswordInput(): HTMLInputElement {
    const input = document.getElementById('verifyPassword');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Expected the password verification field');
    }
    return input;
  }

  async function fillPasswords(newPassword: string, verifyPassword: string) {
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: newPassword },
    });
    fireEvent.change(getVerifyPasswordInput(), {
      target: { value: verifyPassword },
    });

    await waitFor(() => {
      expect(getVerifyPasswordInput()).toHaveValue(verifyPassword);
    });
  }

  async function submitForm() {
    const form = screen
      .getByRole('button', { name: 'Update Password' })
      .closest('form');
    if (!form) {
      throw new Error('Expected the password reset form');
    }
    fireEvent.submit(form);
  }

  it('shows a validation error when passwords do not match', async () => {
    renderPage();

    await fillPasswords('password-one', 'password-two');
    await submitForm();

    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('resets the password and redirects on success', async () => {
    const user = { _id: 'user-1', username: 'member-one' };
    resetPassword.mockResolvedValue(user);

    renderPage();

    await fillPasswords('new-password', 'new-password');
    await submitForm();

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('reset-token', {
        newPassword: 'new-password',
        verifyPassword: 'new-password',
      });
    });

    expect(applyUser).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('reset-success');
  });

  it('shows an error when the reset request fails', async () => {
    resetPassword.mockRejectedValue({
      response: { data: { message: 'Reset token expired.' } },
    });

    renderPage();

    await fillPasswords('new-password', 'new-password');
    await submitForm();

    expect(await screen.findByText('Reset token expired.')).toBeInTheDocument();
  });

  it('keeps the form usable when the rejected value has no API message', async () => {
    // Malformed rejection payload exercises the API error fallback.
    resetPassword.mockRejectedValue('request failed');

    renderPage();
    await fillPasswords('new-password', 'new-password');
    await submitForm();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Update Password' }),
      ).toBeEnabled(),
    );
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])(
    'shows reset guidance for %s without claiming success or retrying',
    async code => {
      resetPassword.mockRejectedValue({ code });
      renderPage();

      await fillPasswords('new-password', 'new-password');
      await submitForm();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not confirm whether your password was changed. Try signing in with your new password before requesting another reset.',
      );
      expect(
        screen.getByRole('button', { name: 'Update Password' }),
      ).toBeEnabled();
      expect(resetPassword).toHaveBeenCalledTimes(1);
      expect(applyUser).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});

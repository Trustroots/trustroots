import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ResetPasswordPage from '@/modules/users/client/components/ResetPasswordPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();

type BoardProps = { children?: React.ReactNode };

jest.mock('@tanstack/react-router', () =>
  jest.requireActual('@/testutils/client/router-location.testutil'),
);
jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/core/client/components/Board', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children }: BoardProps) => <section>{children}</section>,
  };
});

const resetPassword = jest.mocked(authApi.resetPassword);

function SignedInUsername() {
  return <output aria-label="Signed in as">{useAuth().user?.username}</output>;
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/password/reset/reset-token');
    jest.clearAllMocks();
  });

  function renderPage() {
    return render(
      <AppProviders
        analyticsTracker={analytics.tracker}
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: null,
        }}
      >
        <ResetPasswordPage />
        <SignedInUsername />
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

  it('focuses the primary field on desktop', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    try {
      renderPage();
      expect(screen.getByLabelText('New Password')).toHaveFocus();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

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

    expect(screen.getByLabelText('Signed in as')).toHaveTextContent(
      'member-one',
    );
    expect(window.location.pathname).toBe('/password/reset/success');
    expect(analytics.track).toHaveBeenCalledWith('password_reset_completed');
  });

  it('shows an error when the reset request fails', async () => {
    resetPassword.mockRejectedValue({
      response: { status: 400, data: { message: 'Reset token expired.' } },
    });

    renderPage();

    await fillPasswords('new-password', 'new-password');
    await submitForm();

    expect(await screen.findByText('Reset token expired.')).toBeInTheDocument();
    expect(analytics.track).toHaveBeenCalledWith('password_reset_failed', {
      reason: 'invalid_link',
    });
    expect(analytics.track).not.toHaveBeenCalledWith(
      'password_reset_completed',
    );
  });

  it.each([
    [400, 'invalid_link'],
    [429, 'rate_limited'],
    [503, 'server'],
    [undefined, 'server'],
  ])('sends status %s as reason %s', async (status, reason) => {
    resetPassword.mockRejectedValue(
      status === undefined ? new Error('offline') : { response: { status } },
    );

    renderPage();
    await fillPasswords('new-password', 'new-password');
    await submitForm();

    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('password_reset_failed', {
        reason,
      }),
    );
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
      expect(screen.getByLabelText('Signed in as')).toBeEmptyDOMElement();
      expect(window.location.pathname).toBe('/password/reset/reset-token');
    },
  );
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import * as clientRuntime from '@/modules/core/client/services/client-runtime';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import type { AuthenticatedUser } from '@/modules/users/client/api/auth.api';

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({
    signup: 'true',
    token: 'confirm-token',
  })),
  navigate: jest.fn(),
}));
const mockedAuthApi = jest.mocked(authApi);
const mockedClientRuntime = jest.mocked(clientRuntime);

function renderPage(user: AuthUser | null) {
  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: {},
        title: 'Trustroots',
        user,
      }}
    >
      <ConfirmEmailPage />
    </AppProviders>,
  );
}

function confirmedUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    _id: 'user-1',
    username: 'sample-member',
    email: 'sample@example.org',
    ...overrides,
  };
}

describe('ConfirmEmailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirms email and shows success state', async () => {
    mockedAuthApi.confirmEmail.mockResolvedValue({
      profileMadePublic: false,
      user: confirmedUser({ email: 'ada@example.org' }),
    });

    renderPage(null);

    expect(
      screen.getByText(
        'Confirm your email and make your profile visible to others.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText('Your email is now confirmed!'),
    ).toBeInTheDocument();
    expect(mockedAuthApi.confirmEmail).toHaveBeenCalledWith('confirm-token');
  });

  it('requires sign-in again when confirming email for an MFA account', async () => {
    mockedAuthApi.confirmEmail.mockResolvedValue({
      mfaRequired: true,
      profileMadePublic: true,
      user: confirmedUser({ email: 'ada@example.org' }),
    });

    renderPage({
      _id: 'user-1',
      username: 'sample-member',
      email: 'ada@example.org',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText(
        /Sign in with your password and authenticator code/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/signin',
    );
    expect(
      screen.queryByRole('link', { name: 'Edit your profile' }),
    ).not.toBeInTheDocument();
  });

  it('redirects to welcome when the profile becomes public', async () => {
    const navigate = mockedClientRuntime.navigate;
    mockedAuthApi.confirmEmail.mockResolvedValue({
      profileMadePublic: true,
      user: confirmedUser({ email: 'ada@example.org', public: true }),
    });

    renderPage(null);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findByRole('button', { name: 'Confirm' });
    expect(navigate).toHaveBeenCalledWith('welcome');
  });

  it('shows an error state for invalid tokens', async () => {
    mockedAuthApi.confirmEmail.mockRejectedValue(new Error('invalid token'));

    renderPage({
      _id: 'user-1',
      username: 'sample-member',
      email: 'sample@example.org',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText(/Email confirm token is invalid or has expired/),
    ).toBeVisible();
    expect(screen.getByText('sample@example.org')).toBeInTheDocument();
  });

  it('uses the generic confirmation copy for non-signup users', () => {
    mockedClientRuntime.getCurrentRouteParams.mockReturnValue({
      token: 'short-token',
    });

    renderPage(null);

    expect(screen.getByText('Confirm your email.')).toBeInTheDocument();
  });

  it('handles invalid confirmations without a token or signed-in member', async () => {
    mockedClientRuntime.getCurrentRouteParams.mockReturnValue({
      signup: 'true',
    });
    mockedAuthApi.confirmEmail.mockRejectedValue(new Error('invalid token'));

    renderPage(null);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText(/Email confirm token is invalid or has expired/),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'your settings' }),
    ).not.toBeInTheDocument();
    expect(mockedAuthApi.confirmEmail).toHaveBeenCalledWith(undefined);
  });
});

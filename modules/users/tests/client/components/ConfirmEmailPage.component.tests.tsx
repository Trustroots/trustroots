import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import type { AuthenticatedUser } from '@/modules/users/client/api/auth.api';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();

jest.mock('@tanstack/react-router', () =>
  jest.requireActual('@/testutils/client/router-location.testutil'),
);
jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
}));
const mockedAuthApi = jest.mocked(authApi);

function renderPage(user: AuthUser | null) {
  return render(
    <AppProviders
      analyticsTracker={analytics.tracker}
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
    window.history.pushState(
      {},
      '',
      '/confirm-email/confirm-token?signup=true',
    );
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
    expect(analytics.track).toHaveBeenCalledWith('email_confirmed', {
      kind: 'change',
    });
    expect(analytics.track).not.toHaveBeenCalledWith(
      'email_confirm_failed',
      expect.anything(),
    );
  });

  it('redirects to welcome when the profile becomes public', async () => {
    mockedAuthApi.confirmEmail.mockResolvedValue({
      profileMadePublic: true,
      user: confirmedUser({ email: 'ada@example.org', public: true }),
    });

    renderPage(null);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findByRole('button', { name: 'Confirm' });
    expect(window.location.pathname).toBe('/welcome');
    expect(analytics.track).toHaveBeenCalledWith('email_confirmed', {
      kind: 'signup',
    });
  });

  it('shows an error state for invalid tokens', async () => {
    mockedAuthApi.confirmEmail.mockRejectedValue({
      response: { status: 400 },
    });

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
    expect(analytics.track).toHaveBeenCalledWith('email_confirm_failed', {
      reason: 'invalid_link',
    });
    expect(analytics.track).not.toHaveBeenCalledWith(
      'email_confirmed',
      expect.anything(),
    );
  });

  it('uses the generic confirmation copy for non-signup users', () => {
    window.history.pushState({}, '', '/confirm-email/short-token');

    renderPage(null);

    expect(screen.getByText('Confirm your email.')).toBeInTheDocument();
  });

  it('handles invalid confirmations without a token or signed-in member', async () => {
    window.history.pushState({}, '', '/confirm-email/?signup=true');
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

  it.each([
    ['a 503', { response: { status: 503 } }],
    ['no response', new Error('offline')],
  ])('sends reason server for %s', async (_label, rejection) => {
    mockedAuthApi.confirmEmail.mockRejectedValue(rejection);

    renderPage(null);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('email_confirm_failed', {
        reason: 'server',
      }),
    );
  });
});

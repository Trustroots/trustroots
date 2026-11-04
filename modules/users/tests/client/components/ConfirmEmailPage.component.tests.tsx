import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import * as clientRuntime from '@/modules/core/client/services/client-runtime';
import type { AuthUser } from '@/modules/core/client/react-app/auth';

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
const mockedClientRuntime = jest.mocked(clientRuntime);
const details = {
  currentEmail: 'previous@example.org',
  newEmail: 'new@example.org',
  signup: false,
};
const user = {
  _id: 'user-1',
  username: 'sample-member',
  email: details.newEmail,
};

function renderPage(member: AuthUser | null = null) {
  return render(
    <AppProviders
      analyticsTracker={analytics.tracker}
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: {},
        title: 'Trustroots',
        user: member,
      }}
    >
      <ConfirmEmailPage />
    </AppProviders>,
  );
}

async function confirmButton(name = 'Confirm email change') {
  return screen.findByRole('button', { name });
}

describe('ConfirmEmailPage', () => {
  it.each([
    ['a 503', { response: { status: 503 } }],
    ['no response', new Error('offline')],
  ])('tracks confirmation failure for %s', async (_label, rejection) => {
    mockedAuthApi.confirmEmail.mockRejectedValue(rejection);
    renderPage();
    fireEvent.click(await confirmButton());
    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('email_confirm_failed', {
        reason: 'server',
      }),
    );
  });
  it('cancels a change and keeps the current address without signing in', async () => {
    mockedAuthApi.cancelEmailChange.mockResolvedValue({
      currentEmail: details.currentEmail,
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancel email change' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Email change cancelled' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(details.currentEmail);
    expect(mockedAuthApi.cancelEmailChange).toHaveBeenCalledWith(
      'opaque-token',
    );
    expect(mockedClientRuntime.broadcastClientEvent).not.toHaveBeenCalled();
    expect(mockedAuthApi.confirmEmail).not.toHaveBeenCalled();
  });

  it('prevents confirming while cancellation is in progress and allows retry after failure', async () => {
    let fail!: (reason: Error) => void;
    mockedAuthApi.cancelEmailChange.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancel email change' }),
    );
    expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Confirm email change' }),
    ).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Email confirmation' }));
    expect(mockedAuthApi.confirmEmail).not.toHaveBeenCalled();
    await act(async () => fail(new Error('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to cancel');
    expect(
      screen.getByRole('button', { name: 'Cancel email change' }),
    ).toBeEnabled();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    window.history.pushState({}, '', '/confirm-email/opaque-token');
    mockedAuthApi.getEmailConfirmationDetails.mockResolvedValue(details);
    mockedAuthApi.confirmEmail.mockResolvedValue({
      profileMadePublic: false,
      user,
    });
  });

  it('previews both addresses while signed out and confirms the change', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading email details…',
    );
    const button = await confirmButton();
    expect(screen.getByText(details.currentEmail)).toBeVisible();
    expect(screen.getByText(details.newEmail)).toBeVisible();
    expect(screen.getByText('Current email')).toBeVisible();
    expect(screen.getByText('New email')).toBeVisible();
    expect(mockedAuthApi.confirmEmail).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(
      await screen.findByRole('heading', { name: 'Email confirmed' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(details.newEmail);
    expect(mockedAuthApi.confirmEmail).toHaveBeenCalledWith('opaque-token');
    expect(analytics.track).toHaveBeenCalledWith('email_confirmed', {
      kind: 'change',
    });
    expect(mockedAuthApi.getEmailConfirmationDetails).toHaveBeenCalledWith(
      'opaque-token',
    );
  });

  it('uses server signup status even without a signup query parameter', async () => {
    mockedAuthApi.getEmailConfirmationDetails.mockResolvedValue({
      ...details,
      signup: true,
    });
    mockedAuthApi.confirmEmail.mockResolvedValue({
      profileMadePublic: true,
      user,
    });
    renderPage();
    const button = await confirmButton('Confirm email');
    expect(screen.getByText(/make your profile visible/)).toBeVisible();
    expect(screen.queryByText('Current email')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel email change' }),
    ).not.toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(window.location.pathname).toBe('/welcome'));
    expect(analytics.track).toHaveBeenCalledWith('email_confirmed', {
      kind: 'signup',
    });
  });

  it('disables submission while confirming', async () => {
    let finish!: (value: authApi.ConfirmEmailResponse) => void;
    mockedAuthApi.confirmEmail.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    renderPage();
    fireEvent.click(await confirmButton());
    expect(screen.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Email confirmation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirming…' }));
    expect(mockedAuthApi.confirmEmail).toHaveBeenCalledTimes(1);
    await act(async () => finish({ user }));
  });

  it('offers settings when confirmation fails for a signed-in member', async () => {
    mockedAuthApi.confirmEmail.mockRejectedValue({ response: { status: 400 } });
    renderPage(user);
    fireEvent.click(await confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not confirm your email.',
    );
    expect(analytics.track).toHaveBeenCalledWith('email_confirm_failed', {
      reason: 'invalid_link',
    });
    expect(screen.getByRole('link', { name: 'your settings' })).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(details.newEmail)).not.toBeInTheDocument();
  });

  it('offers sign-in when preview fails and does not expose addresses', async () => {
    mockedAuthApi.getEmailConfirmationDetails.mockRejectedValue(
      new Error('invalid'),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Login first' })).toBeVisible();
    expect(screen.queryByText(details.currentEmail)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('handles missing tokens without making a request', async () => {
    window.history.pushState({}, '', '/confirm-email/');
    renderPage();
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(mockedAuthApi.getEmailConfirmationDetails).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'])(
    'ignores a preview that settles after unmount (%s)',
    async outcome => {
      let finish!: (value: authApi.EmailConfirmationDetails) => void;
      let fail!: (reason: Error) => void;
      mockedAuthApi.getEmailConfirmationDetails.mockReturnValue(
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
      );
      const view = renderPage();
      view.unmount();
      await act(async () => {
        if (outcome === 'resolve') finish(details);
        else fail(new Error('offline'));
      });
    },
  );
});

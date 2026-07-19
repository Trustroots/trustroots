import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ConfirmEmailPage from '@/modules/users/client/components/ConfirmEmailPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({
    signup: 'true',
    token: 'confirm-token',
  })),
  navigate: jest.fn(),
}));

describe('ConfirmEmailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirms email and shows success state', async () => {
    authApi.confirmEmail.mockResolvedValue({
      profileMadePublic: false,
      user: { _id: 'user-1', email: 'ada@example.com' },
    });

    render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: null,
        }}
      >
        <ConfirmEmailPage />
      </AppProviders>,
    );

    expect(
      screen.getByText(
        'Confirm your email and make your profile visible to others.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText('Your email is now confirmed!'),
    ).toBeInTheDocument();
    expect(authApi.confirmEmail).toHaveBeenCalledWith('confirm-token');
  });

  it('redirects to welcome when the profile becomes public', async () => {
    const {
      navigate,
    } = require('@/modules/core/client/services/client-runtime');
    authApi.confirmEmail.mockResolvedValue({
      profileMadePublic: true,
      user: { _id: 'user-1', email: 'ada@example.com', public: true },
    });

    render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: null,
        }}
      >
        <ConfirmEmailPage />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await screen.findByRole('button', { name: 'Confirm' });
    expect(navigate).toHaveBeenCalledWith('welcome');
  });

  it('shows an error state for invalid tokens', async () => {
    authApi.confirmEmail.mockRejectedValue(new Error('invalid token'));

    render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: { _id: 'user-1', email: 'ada@example.com' },
        }}
      >
        <ConfirmEmailPage />
      </AppProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText(/Email confirm token is invalid or has expired/),
    ).toBeVisible();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('uses the generic confirmation copy for non-signup users', () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ token: 'short-token' });

    render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: null,
        }}
      >
        <ConfirmEmailPage />
      </AppProviders>,
    );

    expect(screen.getByText('Confirm your email.')).toBeInTheDocument();
  });

  it('handles invalid confirmations without a token or signed-in member', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ signup: 'true' });
    authApi.confirmEmail.mockRejectedValue(new Error('invalid token'));

    render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: null,
        }}
      >
        <ConfirmEmailPage />
      </AppProviders>,
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText(/Email confirm token is invalid or has expired/),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'your settings' }),
    ).not.toBeInTheDocument();
    expect(authApi.confirmEmail).toHaveBeenCalledWith(undefined);
  });
});

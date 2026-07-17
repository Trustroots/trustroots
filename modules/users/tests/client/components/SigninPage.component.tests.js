import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import SigninPage from '@/modules/users/client/components/SigninPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import { redirectAfterSignin } from '@/modules/users/client/utils/auth';

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/users/client/utils/auth', () => ({
  ...jest.requireActual('@/modules/users/client/utils/auth'),
  redirectAfterSignin: jest.fn(),
}));
jest.mock('@/modules/core/client/components/Board', () => ({
  __esModule: true,
  default: ({ children }) => <section>{children}</section>,
}));
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
  trackEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({})),
  navigate: jest.fn(),
}));

describe('SigninPage', () => {
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
        <SigninPage />
      </AppProviders>,
    );
  }

  it('renders the sign-in form', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email or username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('submits credentials and redirects after success', async () => {
    authApi.signin.mockResolvedValue({ _id: 'user-1', username: 'ada' });

    renderPage();

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'ada' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(authApi.signin).toHaveBeenCalledWith({
        password: 'secret-pass',
        username: 'ada',
      });
    });

    expect(redirectAfterSignin).toHaveBeenCalledWith(false);
  });

  it('shows an error message when sign-in fails', async () => {
    authApi.signin.mockRejectedValue({
      response: { data: { message: 'Invalid credentials.' } },
    });

    renderPage();

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'ada' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Invalid credentials.')).toBeInTheDocument();
  });

  it('uses the fallback sign-in error and continue label', async () => {
    const {
      getCurrentRouteParams,
    } = require('@/modules/core/client/services/client-runtime');
    getCurrentRouteParams.mockReturnValue({ continue: '1' });
    authApi.signin.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(
      screen.getByRole('button', { name: 'Sign in to continue' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'ada' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in to continue' }),
    );

    expect(await screen.findByText('Something went wrong.')).toBeVisible();
  });

  it('toggles password visibility', () => {
    renderPage();

    const password = screen.getByLabelText('Password');
    fireEvent.click(
      screen.getByRole('button', { name: 'Toggle password visibility' }),
    );
    expect(password).toHaveAttribute('type', 'text');
    fireEvent.click(
      screen.getByRole('button', { name: 'Toggle password visibility' }),
    );
    expect(password).toHaveAttribute('type', 'password');
  });
});

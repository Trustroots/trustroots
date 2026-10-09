import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import SigninPage from '@/modules/users/client/components/SigninPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import * as clientRuntime from '@/modules/core/client/services/client-runtime';
import { redirectAfterSignin } from '@/modules/users/client/utils/auth';

type BoardProps = { children?: React.ReactNode };

jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/users/client/utils/auth', () => ({
  ...jest.requireActual('@/modules/users/client/utils/auth'),
  redirectAfterSignin: jest.fn(),
}));
jest.mock('@/modules/core/client/components/Board', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children }: BoardProps) => <section>{children}</section>,
  };
});
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
  trackEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({})),
  navigate: jest.fn(),
}));

const signin = jest.mocked(authApi.signin);
const getSession = jest.mocked(authApi.getSession);
const routeParams = jest.mocked(clientRuntime.getCurrentRouteParams);

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

describe('SigninPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockReset();
    getSession.mockResolvedValue({ userId: 'user-1' });
    routeParams.mockReturnValue({});
  });

  it('renders the sign-in form', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email or username')).toHaveFocus();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('submits credentials and redirects after success', async () => {
    signin.mockResolvedValue({ _id: 'user-1', username: 'member-one' });

    renderPage();

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(signin).toHaveBeenCalledWith({
        password: 'secret-pass',
        username: 'member-one',
      });
    });

    await waitFor(() => {
      expect(redirectAfterSignin).toHaveBeenCalledWith(false, undefined);
    });
  });

  it('preserves the protected destination after successful sign-in', async () => {
    routeParams.mockReturnValue({
      continue: 'true',
      returnTo: '/messages?filter=unread',
    });
    signin.mockResolvedValue({ _id: 'user-1', username: 'member-one' });

    renderPage();

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in to continue' }),
    );

    await waitFor(() => {
      expect(redirectAfterSignin).toHaveBeenCalledWith(
        true,
        '/messages?filter=unread',
      );
    });
  });

  it('shows an error message when sign-in fails', async () => {
    signin.mockRejectedValue({
      response: { data: { message: 'Invalid credentials.' } },
    });

    renderPage();

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Invalid credentials.')).toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('uses the fallback sign-in error and continue label', async () => {
    routeParams.mockReturnValue({ continue: '1' });
    signin.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(
      screen.getByRole('button', { name: 'Sign in to continue' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in to continue' }),
    );

    expect(await screen.findByText('Something went wrong.')).toBeVisible();
  });

  it.each([null, 'another-member'])(
    'explains an unconfirmed session (%s) and allows retry',
    async userId => {
      signin.mockResolvedValue({ _id: 'user-1', username: 'member-one' });
      getSession.mockResolvedValueOnce({ userId });
      renderPage();
      fireEvent.change(screen.getByLabelText('Email or username'), {
        target: { value: 'member-one' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'secret-pass' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Cookies may be blocked, or there may be a problem with the site.',
      );
      expect(redirectAfterSignin).not.toHaveBeenCalled();
      expect(
        screen.queryByText('Recover your password'),
      ).not.toBeInTheDocument();
      expect(clientRuntime.trackEvent).not.toHaveBeenCalled();
      expect(clientRuntime.broadcastClientEvent).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();

      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
      await waitFor(() => expect(redirectAfterSignin).toHaveBeenCalled());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('distinguishes a failed session check from blocked cookies', async () => {
    signin.mockResolvedValue({ _id: 'user-1', username: 'member-one' });
    getSession.mockRejectedValueOnce(new Error('offline'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "we couldn't check your session. Check your connection and try again.",
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('Cookies');
    expect(redirectAfterSignin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  });

  it('waits for session confirmation before completing sign-in', async () => {
    signin.mockResolvedValue({ _id: 'user-1', username: 'member-one' });
    let confirmSession!: (session: { userId: string | null }) => void;
    getSession.mockReturnValueOnce(
      new Promise(resolve => {
        confirmSession = resolve;
      }),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(redirectAfterSignin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wait...' })).toBeDisabled();
    confirmSession({ userId: 'user-1' });
    await waitFor(() => expect(redirectAfterSignin).toHaveBeenCalled());
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

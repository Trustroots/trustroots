import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import SigninPage from '@/modules/users/client/components/SigninPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import { signinWithPasskey } from '@/modules/users/client/api/passkeys.api';
import * as clientRuntime from '@/modules/core/client/services/client-runtime';
import { redirectAfterSignin } from '@/modules/users/client/utils/auth';

type BoardProps = { children?: React.ReactNode };

vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);
vi.mock('@/modules/users/client/api/auth.api');
vi.mock('@/modules/users/client/api/passkeys.api');
vi.mock('@/modules/users/client/utils/auth', async () => ({
  ...(await vi.importActual('@/modules/users/client/utils/auth')),
  redirectAfterSignin: vi.fn(),
}));
vi.mock('@/modules/core/client/components/Board', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ children }: BoardProps) => <section>{children}</section>,
  };
});
vi.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: vi.fn(),
}));

const signin = vi.mocked(authApi.signin);
const verifyMfa = vi.mocked(authApi.verifyMfa);
const getSession = vi.mocked(authApi.getSession);
const analytics = fakeAnalytics();

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
      <SigninPage />
    </AppProviders>,
  );
}

describe('SigninPage', () => {
  it('completes a staff second factor using a registered passkey', async () => {
    signin.mockResolvedValue({ mfaRequired: true, passkeyAvailable: true });
    vi.mocked(signinWithPasskey).mockResolvedValue({
      _id: 'user-1',
      username: 'fictional-member',
    });
    renderPage();
    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'fictional-member' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'FictionalPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Use a registered passkey' }),
    );
    await waitFor(() => expect(redirectAfterSignin).toHaveBeenCalled());
    expect(signinWithPasskey).toHaveBeenCalledTimes(1);
    expect(verifyMfa).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockReset();
    getSession.mockResolvedValue({ userId: 'user-1' });
    window.history.pushState({}, '', '/signin');
  });

  it('renders the sign-in form', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email or username')).not.toHaveFocus();
    expect(screen.getByLabelText('Email or username')).not.toHaveAttribute(
      'tabindex',
    );
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it.each([true, false])(
    'focuses the username field only on desktop (%s)',
    desktop => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: desktop });
      try {
        renderPage();
        if (desktop) {
          expect(screen.getByLabelText('Email or username')).toHaveFocus();
        } else {
          expect(screen.getByLabelText('Email or username')).not.toHaveFocus();
        }
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    },
  );

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
      expect(redirectAfterSignin).toHaveBeenCalledWith(
        expect.any(Function),
        false,
        undefined,
      );
    });
    expect(analytics.track).toHaveBeenCalledWith('signin_succeeded');
  });

  it('requires and verifies a second factor before checking the session', async () => {
    signin.mockResolvedValue({ mfaRequired: true });
    verifyMfa.mockResolvedValue({ _id: 'user-1', username: 'ada' });
    renderPage();

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'ada' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(
      await screen.findByLabelText('Authenticator or recovery code'),
    ).toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Authenticator or recovery code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await waitFor(() => {
      expect(verifyMfa).toHaveBeenCalledWith('123456');
      expect(redirectAfterSignin).toHaveBeenCalledWith(
        expect.any(Function),
        false,
        undefined,
      );
    });
  });

  it('preserves the protected destination after successful sign-in', async () => {
    window.history.pushState(
      {},
      '',
      '/signin?continue=true&returnTo=%2Fmessages%3Ffilter%3Dunread',
    );
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
        expect.any(Function),
        true,
        '/messages?filter=unread',
      );
    });
  });

  it('shows an error message when sign-in fails', async () => {
    signin.mockRejectedValue({
      response: { status: 400, data: { message: 'Invalid credentials.' } },
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
    expect(analytics.track).toHaveBeenCalledWith('signin_failed', {
      reason: 'credentials',
    });
  });

  it.each([
    [400, 'credentials'],
    [403, 'suspended'],
    [429, 'rate_limited'],
    [503, 'server'],
    [undefined, 'server'],
  ])('sends status %s as reason %s', async (status, reason) => {
    signin.mockRejectedValue(
      status === undefined ? new Error('offline') : { response: { status } },
    );

    renderPage();

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'member-one' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith('signin_failed', {
        reason,
      }),
    );
  });

  it('uses the fallback sign-in error and continue label', async () => {
    window.history.pushState({}, '', '/signin?continue=1');
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
      expect(analytics.track).not.toHaveBeenCalled();
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

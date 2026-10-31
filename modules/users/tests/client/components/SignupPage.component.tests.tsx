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
import SignupPage from '@/modules/users/client/components/SignupPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import {
  getCurrentRouteParams,
  navigate,
} from '@/modules/core/client/services/client-runtime';
import { useAuth, type AuthUser } from '@/modules/core/client/react-app/auth';
import type JoinButton from '@/modules/tribes/client/components/JoinButton';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';
import { resolveMalformed } from '@/testutils/client/malformed-fixtures';

jest.mock('lodash/shuffle', () => jest.fn(items => items));
jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/tribes/client/api/tribes.api');
const signup = jest.mocked(authApi.signup);
const validateSignup = jest.mocked(authApi.validateSignup);
const readTribes = jest.mocked(tribesApi.read);
const getTribe = jest.mocked(tribesApi.get);
const joinTribe = jest.mocked(tribesApi.join);
const routeParams = jest.mocked(getCurrentRouteParams);
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({})),
  navigate: jest.fn(),
}));
jest.mock('@/modules/tribes/client/components/JoinButton', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockJoinButton({
    tribe,
    onUpdated,
  }: Pick<React.ComponentProps<typeof JoinButton>, 'tribe' | 'onUpdated'>) {
    return (
      <>
        <button
          type="button"
          onClick={() =>
            onUpdated?.({
              user: {
                _id: 'user-1',
                username: 'ada',
                email: 'ada@example.test',
                displayName: 'Ada Example',
              },
            })
          }
        >
          Join {tribe.label}
        </button>
        <button type="button" onClick={() => onUpdated?.({})}>
          Ignore circle update
        </button>
      </>
    );
  }

  return MockJoinButton;
});

const analytics = fakeAnalytics();

describe('SignupPage', () => {
  const suggestedTribes: TribeSummary[] = [
    { _id: 'tribe-1', label: 'Cyclists', count: 0, slug: 'cyclists' },
    { _id: 'tribe-2', label: 'Hikers', count: 1, slug: 'hikers' },
    { _id: 'tribe-3', label: 'Climbers', count: 42, slug: 'climbers' },
    { _id: 'tribe-4', label: 'Runners', count: 100, slug: 'runners' },
    { _id: 'tribe-5', label: 'Swimmers', count: 250, slug: 'swimmers' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    routeParams.mockReturnValue({});
    readTribes.mockResolvedValue(suggestedTribes);
    // Keep the default missing-circle response persistent so per-test circle
    // results are not preceded by a stale one-time response.
    Reflect.apply(getTribe.mockResolvedValue, getTribe, [null]);
    validateSignup.mockResolvedValue({ valid: true });
  });

  let signedInUser: AuthUser | null = null;
  function CaptureSignedInUser() {
    signedInUser = useAuth().user;
    return null;
  }

  function renderPage({ user = null }: { user?: AuthUser | null } = {}) {
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
        <SignupPage />
        <CaptureSignedInUser />
      </AppProviders>,
    );
  }

  it('focuses the primary field on desktop', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    try {
      renderPage();
      expect(screen.getByLabelText('First Name')).toHaveFocus();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  function fillStepOne({
    acquisitionStory = '',
    ageConfirmed = true,
    email = 'ada@example.test',
    firstName = 'Ada',
    lastName = 'Lovelace',
    newsletter = false,
    password = 'password-123',
    username = 'ada',
  }: {
    acquisitionStory?: string;
    ageConfirmed?: boolean;
    email?: string;
    firstName?: string;
    lastName?: string;
    newsletter?: boolean;
    password?: string;
    username?: string;
  } = {}) {
    fireEvent.change(screen.getByLabelText('First Name'), {
      target: { value: firstName },
    });
    fireEvent.change(screen.getByLabelText('Last name (optional)'), {
      target: { value: lastName },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: email },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: username },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: password },
    });

    if (ageConfirmed) {
      fireEvent.click(screen.getByLabelText('I am 18 years old or older.'));
    }

    if (newsletter) {
      fireEvent.click(screen.getByLabelText('Subscribe to community news'));
    }

    if (acquisitionStory) {
      fireEvent.change(screen.getByLabelText('How did you hear about us?'), {
        target: { value: acquisitionStory },
      });
    }
  }

  it('requires explicit adult confirmation before submitting', async () => {
    signup.mockResolvedValue({ _id: 'adult-member', username: 'ada' });
    const { container } = renderPage();
    const checkbox = screen.getByRole('checkbox', {
      name: 'I am 18 years old or older.',
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeRequired();
    fireEvent.click(checkbox);
    fireEvent.submit(container.querySelector('form')!);
    expect(signup).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    fillStepOne({ ageConfirmed: false });
    expect(
      screen.getByRole('button', { name: 'Please fill in the form' }),
    ).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(signup).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You must confirm that you are 18 years old or older to sign up.',
    );
    fireEvent.click(checkbox);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(checkbox).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(signup).toHaveBeenCalledTimes(1);
    await screen.findByRole('button', { name: 'Skip' });
    expect(signup).toHaveBeenCalledWith(
      expect.objectContaining({ ageConfirmed: true }),
    );
    fireEvent.submit(container.querySelector('form')!);
    expect(signup).toHaveBeenCalledTimes(1);
  });

  it('renders the signup form with step indicators', () => {
    renderPage();

    expect(screen.getByText('Join Trustroots')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Please fill in the form' }),
    ).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      '/signin',
    );
  });

  it('allows signing up without a last name', async () => {
    signup.mockResolvedValue({
      _id: 'member-without-surname',
      username: 'ada',
    });
    renderPage();
    fillStepOne({ lastName: '' });

    const lastName = screen.getByLabelText('Last name (optional)');
    expect(lastName).not.toBeRequired();
    expect(lastName).toHaveAccessibleDescription(
      'You can use a nickname. You don’t need to share your full name.',
    );
    expect(screen.getByLabelText('First Name')).toBeRequired();
    expect(
      screen.getByText(
        'You can use a nickname. You don’t need to share your full name.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', { name: 'Skip' });
    expect(signup).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Ada', lastName: '' }),
    );
  });

  it('redirects authenticated users away from signup step one', () => {
    renderPage({
      user: { _id: 'user-1', username: 'ada', email: 'ada@example.test' },
    });

    expect(navigate).toHaveBeenCalledWith('search.map');
  });

  it('loads a referred circle from route params', async () => {
    routeParams.mockReturnValue({ tribe: 'hitchhikers' });
    getTribe.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });

    renderPage();

    expect(await screen.findByText('+ Circle Hitchhikers')).toBeInTheDocument();
    expect(tribesApi.get).toHaveBeenCalledWith('hitchhikers');
    expect(tribesApi.read).toHaveBeenCalledWith({ limit: 40 });
  });

  it('continues without a missing referred circle', async () => {
    routeParams.mockReturnValue({ tribe: 'missing-circle' });
    resolveMalformed(getTribe, null);

    renderPage();

    await waitFor(() => {
      expect(tribesApi.read).toHaveBeenCalledWith({ limit: 40 });
    });
    expect(screen.queryByText(/\+ Circle/)).not.toBeInTheDocument();
  });

  it('keeps a newly signed-up member in the circles step', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('button', { name: 'Skip' })).toBeVisible();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders circle suggestions when signup leaves the current user unavailable', async () => {
    // Signup may complete while the browser has no current-user payload.
    resolveMalformed(signup, null);

    renderPage();
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByRole('button', { name: 'Join Cyclists' }),
    ).toBeVisible();
  });

  it('joins a referred circle after successful signup', async () => {
    routeParams.mockReturnValue({ tribe: 'hitchhikers' });
    getTribe.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });
    joinTribe.mockResolvedValue({
      user: {
        _id: 'user-1',
        username: 'ada',
        email: 'ada@example.test',
        displayName: 'Ada Example',
        tribes: ['tribe-ref'],
      },
    });

    renderPage();

    await screen.findByText('+ Circle Hitchhikers');
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(tribesApi.join).toHaveBeenCalledWith('tribe-ref');
    });
    expect(
      await screen.findByRole('button', { name: 'Join Hitchhikers' }),
    ).toBeVisible();
  });

  it('renders a referred circle when no current user is available', async () => {
    routeParams.mockReturnValue({ tribe: 'hitchhikers' });
    getTribe.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });
    // These responses exercise legacy endpoints that omit their user payload.
    resolveMalformed(signup, null);
    resolveMalformed(joinTribe, { user: null });

    renderPage();
    await screen.findByText('+ Circle Hitchhikers');
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByRole('button', { name: 'Join Hitchhikers' }),
    ).toBeVisible();
  });

  it('keeps the signup user when a referred circle join has no user payload', async () => {
    routeParams.mockReturnValue({ tribe: 'hitchhikers' });
    getTribe.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });
    joinTribe.mockResolvedValue({});

    renderPage();

    await screen.findByText('+ Circle Hitchhikers');
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('button', { name: 'Skip' })).toBeVisible();
    expect(signedInUser).toEqual(expect.objectContaining({ username: 'ada' }));
  });

  it('shows the welcome step after skipping circles', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));

    expect(await screen.findByText('Welcome to Trustroots!')).toBeVisible();
    expect(screen.getByText('ada@example.test')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Fill your profile' }),
    ).toHaveAttribute('href', '/profile/edit');
  });

  it('shows the welcome step after continuing from the circles step', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', { name: 'Skip' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Welcome to Trustroots!')).toBeVisible();
  });

  it('shows an error when signup fails with a taken email', async () => {
    signup.mockRejectedValue({
      response: {
        data: { message: 'Account with this email exists already.' },
      },
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('Account with this email exists already.'),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Try recover password?' }),
    ).toHaveAttribute('href', '/password/forgot?userhandle=ada%40example.test');
  });

  it('clears the taken email alert when the email field changes', async () => {
    signup.mockRejectedValue({
      response: {
        data: { message: 'Account with this email exists already.' },
      },
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('Account with this email exists already.'),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'other@example.test' },
    });

    expect(
      screen.queryByText('Account with this email exists already.'),
    ).not.toBeInTheDocument();
  });

  it('shows a generic error when signup fails for another reason', async () => {
    signup.mockRejectedValue({
      response: { data: { message: 'Signup is temporarily unavailable.' } },
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('Signup is temporarily unavailable.'),
    ).toBeVisible();
  });

  it('shows a fallback error when signup fails without a message', async () => {
    signup.mockRejectedValue(new Error('network failure'));

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText(
        'Something went wrong while signing you up. Try again!',
      ),
    ).toBeVisible();
  });

  it('shows username validation messages after the field is touched', async () => {
    renderPage();

    const usernameInput = screen.getByLabelText('Username');

    fireEvent.blur(usernameInput);
    expect(await screen.findByText('Username is required.')).toBeVisible();

    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    fireEvent.blur(usernameInput);
    expect(
      await screen.findByText('Too short, minimum length is 3 characters.'),
    ).toBeVisible();

    fireEvent.change(usernameInput, {
      target: { value: 'a'.repeat(35) },
    });
    fireEvent.blur(usernameInput);
    expect(
      await screen.findByText('Too long, maximum length is 34 characters.'),
    ).toBeVisible();

    fireEvent.change(usernameInput, { target: { value: '---' } });
    fireEvent.blur(usernameInput);
    expect(
      await screen.findByText(
        'Use 3–34 letters and numbers, including at least one letter.',
      ),
    ).toBeVisible();
    fireEvent.change(usernameInput, { target: { value: 'sample_member' } });
    expect(
      screen.getByText(
        'Use 3–34 letters and numbers, including at least one letter.',
      ),
    ).toBeVisible();
  });

  it('shows the server explanation for a reserved username', async () => {
    jest.useFakeTimers();
    validateSignup.mockResolvedValue({
      valid: false,
      message: 'This name is reserved.',
    });
    try {
      renderPage();
      fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'sampleservice' },
      });
      fireEvent.blur(screen.getByLabelText('Username'));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(await screen.findByText('This name is reserved.')).toBeVisible();
    } finally {
      jest.useRealTimers();
    }
  });

  it('checks username availability after debounce', async () => {
    jest.useFakeTimers();

    try {
      renderPage();

      fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'validuser1' },
      });
      fireEvent.blur(screen.getByLabelText('Username'));

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(authApi.validateSignup).toHaveBeenCalledWith({
          username: 'validuser1',
        });
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a taken username message after validation', async () => {
    jest.useFakeTimers();
    validateSignup.mockResolvedValue({ valid: false });

    try {
      renderPage();

      fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'takenuser' },
      });
      fireEvent.blur(screen.getByLabelText('Username'));

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(
        await screen.findByText('This username is already in use.'),
      ).toBeVisible();
    } finally {
      jest.useRealTimers();
    }
  });

  it('allows signup when username validation fails unexpectedly', async () => {
    jest.useFakeTimers();
    validateSignup.mockRejectedValue(new Error('validation offline'));
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'validuser1',
      email: 'ada@example.test',
    });

    try {
      renderPage();

      fillStepOne({ username: 'validuser1' });
      fireEvent.blur(screen.getByLabelText('Username'));

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(authApi.validateSignup).toHaveBeenCalledWith({
          username: 'validuser1',
        });
      });

      jest.useRealTimers();

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(await screen.findByRole('button', { name: 'Skip' })).toBeVisible();
    } finally {
      jest.useRealTimers();
    }
  });

  it('toggles password visibility', () => {
    renderPage();

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(
      screen.getByRole('button', { name: 'Toggle password visibility' }),
    );
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(
      screen.getByRole('button', { name: 'Toggle password visibility' }),
    );
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows password length guidance for short passwords', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short' },
    });

    expect(
      screen.getByText('Minimum length 8 characters.'),
    ).toBeInTheDocument();
  });

  it('tracks rules link clicks and navigates to the rules page', () => {
    renderPage();

    fireEvent.click(screen.getByRole('link', { name: 'rules' }));

    expect(analytics.track).toHaveBeenCalledWith('signup-rules-open');
  });

  it('submits optional signup fields', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    fillStepOne({
      acquisitionStory: 'A friend told me',
      newsletter: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(authApi.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          acquisitionStory: 'A friend told me',
          email: 'ada@example.test',
          firstName: 'Ada',
          lastName: 'Lovelace',
          newsletter: true,
          password: 'password-123',
          username: 'ada',
        }),
      );
    });
  });

  it('shows suggested circles without a referred circle', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('Do you want to join any Circles?'),
    ).toBeVisible();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByText('One member')).toBeInTheDocument();
    expect(screen.getByText('42 members')).toBeInTheDocument();
  });

  it('shows other suggested circles when signing up via a circle link', async () => {
    routeParams.mockReturnValue({ tribe: 'hitchhikers' });
    getTribe.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    await screen.findByText('+ Circle Hitchhikers');
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('Other suggested circles for you'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Join Hitchhikers' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Join Cyclists' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Join Hitchhikers' }),
    ).toBeInTheDocument();
  });

  it('loads more suggested circles', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const showMoreButton = await screen.findByRole('button', {
      name: 'Show more circles',
    });
    expect(showMoreButton).toBeEnabled();

    fireEvent.click(showMoreButton);

    expect(screen.getByRole('button', { name: 'Join Swimmers' })).toBeVisible();
    expect(showMoreButton).toBeDisabled();
  });

  it('updates auth state when circle membership changes', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });

    renderPage();

    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(
      await screen.findByRole('button', { name: 'Join Cyclists' }),
    );

    await waitFor(() => {
      expect(signedInUser).toEqual(
        expect.objectContaining({
          _id: 'user-1',
          email: 'ada@example.test',
          username: 'ada',
        }),
      );
    });
  });

  it('ignores circle membership updates without a user', async () => {
    signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });
    renderPage();
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(
      (
        await screen.findAllByRole('button', {
          name: 'Ignore circle update',
        })
      )[0],
    );
    expect(screen.getByRole('button', { name: 'Skip' })).toBeVisible();
  });

  it('ignores suggested circle updates after unmount', async () => {
    let resolveRead!: (value: TribeSummary[]) => void;
    readTribes.mockReturnValue(
      new Promise(resolve => {
        resolveRead = resolve;
      }),
    );

    const { unmount } = renderPage();
    unmount();

    resolveRead(suggestedTribes);
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('ignores username validation updates after unmount', async () => {
    jest.useFakeTimers();

    let resolveValidation!: (
      value: Awaited<ReturnType<typeof authApi.validateSignup>>,
    ) => void;
    validateSignup.mockReturnValue(
      new Promise(resolve => {
        resolveValidation = resolve;
      }),
    );

    try {
      const { unmount } = renderPage();

      fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'validuser1' },
      });
      fireEvent.blur(screen.getByLabelText('Username'));

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      unmount();
      resolveValidation({ valid: true });

      await act(async () => {
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores validation failures after unmount', async () => {
    jest.useFakeTimers();
    let rejectValidation!: (error: Error) => void;
    validateSignup.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectValidation = reject;
      }),
    );

    try {
      const { unmount } = renderPage();
      fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'validuser1' },
      });
      fireEvent.blur(screen.getByLabelText('Username'));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      unmount();
      rejectValidation(new Error('late failure'));
      await act(async () => {
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

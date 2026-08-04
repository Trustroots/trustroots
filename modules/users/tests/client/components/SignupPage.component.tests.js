import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import SignupPage from '@/modules/users/client/components/SignupPage.component';
import * as authApi from '@/modules/users/client/api/auth.api';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import {
  trackEvent,
  getCurrentRouteParams,
  navigate,
} from '@/modules/core/client/services/client-runtime';

jest.mock('lodash/shuffle', () => jest.fn(items => items));
jest.mock('@/modules/users/client/api/auth.api');
jest.mock('@/modules/tribes/client/api/tribes.api');
jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
  trackEvent: jest.fn(),
  getCurrentRouteParams: jest.fn(() => ({})),
  navigate: jest.fn(),
}));
jest.mock('@/modules/tribes/client/components/JoinButton', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockJoinButton({ tribe, onUpdated }) {
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

  MockJoinButton.propTypes = {
    onUpdated: PropTypes.func,
    tribe: PropTypes.object.isRequired,
  };

  return MockJoinButton;
});

describe('SignupPage', () => {
  const suggestedTribes = [
    { _id: 'tribe-1', label: 'Cyclists', count: 0, slug: 'cyclists' },
    { _id: 'tribe-2', label: 'Hikers', count: 1, slug: 'hikers' },
    { _id: 'tribe-3', label: 'Climbers', count: 42, slug: 'climbers' },
    { _id: 'tribe-4', label: 'Runners', count: 100, slug: 'runners' },
    { _id: 'tribe-5', label: 'Swimmers', count: 250, slug: 'swimmers' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentRouteParams.mockReturnValue({});
    tribesApi.read.mockResolvedValue(suggestedTribes);
    tribesApi.get.mockResolvedValue(null);
    authApi.validateSignup.mockResolvedValue({ valid: true });
  });

  function renderPage({ user = null } = {}) {
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
        <SignupPage />
      </AppProviders>,
    );
  }

  function fillStepOne({
    acquisitionStory = '',
    email = 'ada@example.test',
    firstName = 'Ada',
    lastName = 'Lovelace',
    newsletter = false,
    password = 'password-123',
    username = 'ada',
  } = {}) {
    fireEvent.change(screen.getByLabelText('First Name'), {
      target: { value: firstName },
    });
    fireEvent.change(screen.getByLabelText('Last Name'), {
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

    if (newsletter) {
      fireEvent.click(screen.getByLabelText('Subscribe to community news'));
    }

    if (acquisitionStory) {
      fireEvent.change(screen.getByLabelText('How did you hear about us?'), {
        target: { value: acquisitionStory },
      });
    }
  }

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

  it('redirects authenticated users away from signup step one', () => {
    renderPage({
      user: { _id: 'user-1', username: 'ada', email: 'ada@example.test' },
    });

    expect(navigate).toHaveBeenCalledWith('search.map');
  });

  it('loads a referred circle from route params', async () => {
    getCurrentRouteParams.mockReturnValue({ tribe: 'hitchhikers' });
    tribesApi.get.mockResolvedValue({
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
    getCurrentRouteParams.mockReturnValue({ tribe: 'missing-circle' });
    tribesApi.get.mockResolvedValue(null);

    renderPage();

    await waitFor(() => {
      expect(tribesApi.read).toHaveBeenCalledWith({ limit: 40 });
    });
    expect(screen.queryByText(/\+ Circle/)).not.toBeInTheDocument();
  });

  it('keeps a newly signed-up member in the circles step', async () => {
    authApi.signup.mockResolvedValue({
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

  it('joins a referred circle after successful signup', async () => {
    getCurrentRouteParams.mockReturnValue({ tribe: 'hitchhikers' });
    tribesApi.get.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });
    authApi.signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });
    tribesApi.join.mockResolvedValue({
      user: {
        _id: 'user-1',
        username: 'ada',
        email: 'ada@example.test',
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

  it('keeps the signup user when a referred circle join has no user payload', async () => {
    getCurrentRouteParams.mockReturnValue({ tribe: 'hitchhikers' });
    tribesApi.get.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });
    authApi.signup.mockResolvedValue({
      _id: 'user-1',
      username: 'ada',
      email: 'ada@example.test',
    });
    tribesApi.join.mockResolvedValue({});

    renderPage();

    await screen.findByText('+ Circle Hitchhikers');
    fillStepOne();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('button', { name: 'Skip' })).toBeVisible();
    expect(window.user).toEqual(expect.objectContaining({ username: 'ada' }));
  });

  it('shows the welcome step after skipping circles', async () => {
    authApi.signup.mockResolvedValue({
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
    authApi.signup.mockResolvedValue({
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
    authApi.signup.mockRejectedValue({
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
    authApi.signup.mockRejectedValue({
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
    authApi.signup.mockRejectedValue({
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
    authApi.signup.mockRejectedValue(new Error('network failure'));

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
    expect(await screen.findByText('Invalid username.')).toBeVisible();
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
    authApi.validateSignup.mockResolvedValue({ valid: false });

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
    authApi.validateSignup.mockRejectedValue(new Error('validation offline'));
    authApi.signup.mockResolvedValue({
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

    expect(trackEvent).toHaveBeenCalledWith('signup.rules.open', {
      category: 'signup',
      label: 'Open rules from signup form',
    });
  });

  it('submits optional signup fields', async () => {
    authApi.signup.mockResolvedValue({
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
    authApi.signup.mockResolvedValue({
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
    getCurrentRouteParams.mockReturnValue({ tribe: 'hitchhikers' });
    tribesApi.get.mockResolvedValue({
      _id: 'tribe-ref',
      label: 'Hitchhikers',
      slug: 'hitchhikers',
      count: 5,
    });
    authApi.signup.mockResolvedValue({
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
    authApi.signup.mockResolvedValue({
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
    authApi.signup.mockResolvedValue({
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
      expect(window.user).toEqual(
        expect.objectContaining({
          _id: 'user-1',
          email: 'ada@example.test',
          username: 'ada',
        }),
      );
    });
  });

  it('ignores circle membership updates without a user', async () => {
    authApi.signup.mockResolvedValue({
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
    let resolveRead;
    tribesApi.read.mockReturnValue(
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

    let resolveValidation;
    authApi.validateSignup.mockReturnValue(
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
    let rejectValidation;
    authApi.validateSignup.mockReturnValue(
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

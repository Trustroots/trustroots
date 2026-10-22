import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import type { UserProfile } from '@/modules/users/client/types';
import { malformedFixture } from '@/testutils/client/malformed-fixtures';

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/config/client/i18n', () => ({
  __esModule: true,
  default: {
    language: 'en',
    changeLanguage: jest.fn(),
    dir: () => 'ltr',
  },
}));
const updateUser = jest.mocked(usersApi.update);
const changePassword = jest.mocked(usersApi.changePassword);
const resendConfirmation = jest.mocked(usersApi.resendEmailConfirmation);
const removeProfile = jest.mocked(usersApi.removeProfile);
const getProfileRemovalStatus = jest.mocked(usersApi.getProfileRemovalStatus);
const cancelProfileRemoval = jest.mocked(usersApi.cancelProfileRemoval);
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <section>{children}</section>
    ),
  }),
);
jest.mock('react-i18next', () => {
  const translation = {
    t: (key: string, values?: Record<string, unknown>) => {
      if (values?.email) {
        return key.replace('{{email}}', String(values.email));
      }

      return key;
    },
  };
  return { useTranslation: () => translation };
});

const user: UserProfile = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
  email: 'ada@example.test',
  newsletter: false,
};

function renderUser(profile: UserProfile) {
  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: {},
        title: 'Trustroots',
        user: profile,
      }}
    >
      <ProfileEditAccount user={profile} />
    </AppProviders>,
  );
}

function renderPage(overrides: Partial<UserProfile> = {}) {
  const profile: UserProfile = {
    ...user,
    ...overrides,
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
  };
  return renderUser(profile);
}

describe('ProfileEditAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfileRemovalStatus.mockResolvedValue({ pending: false });
  });

  it('renders account settings sections', () => {
    renderPage();

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByText(/three months after joining/)).toBeVisible();
    expect(screen.getByText(/including at least one letter/)).toBeVisible();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByText('Community newsletter')).toBeInTheDocument();
    expect(screen.getByText('Your data')).toBeVisible();
    expect(
      screen.getByText(/trustroots-data-username-20261014-0931\.json/),
    ).toBeVisible();
    expect(
      screen.getByText(
        /does not include your password, your profile photo file/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Download your data' }),
    ).toHaveAttribute('href', '/api/users/export');
    expect(
      screen.getByLabelText('Yes, I want to remove my profile'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/permanently deletes your Trustroots account/),
    ).toBeVisible();
    expect(
      screen.getByText(/Open the link in the email within 24 hours/),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Read the account removal FAQ' }),
    ).toHaveAttribute('href', '/faq#how-can-i-remove-my-account');
  });

  it('lets a signed-in member change their interface language and saves it', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Čeština' }));

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith({ locale: 'cs' });
    });
  });

  it('focuses and scrolls to removal when opened with its fragment', async () => {
    window.history.replaceState({}, '', '/profile/edit/account#remove');
    const scrollIntoView = jest.fn();
    const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      renderPage();
      await waitFor(() =>
        expect(
          screen.getByRole('region', { name: 'Remove profile' }),
        ).toHaveFocus(),
      );
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
      expect(removeProfile).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = previous;
      window.history.replaceState({}, '', '/');
    }
  });

  it('saves an email change and shows confirmation', async () => {
    updateUser.mockResolvedValue({
      ...user,
      emailTemporary: 'new@example.test',
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'new@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change email' }));

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.test' }),
      );
    });
    expect(
      await screen.findByText(/We sent you an email to new@example.test/),
    ).toBeVisible();
  });

  it('updates the username and shows success', async () => {
    updateUser.mockResolvedValue({ ...user, username: 'grace' });
    renderPage();

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'grace' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change username' }));

    expect(await screen.findByText('Username updated.')).toBeVisible();
  });

  it.each(['sample_member', 'sample-member', 'sample.member', '123456', ''])(
    'rejects an invalid new username %s before submitting',
    async username => {
      renderPage();
      fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: username },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Change username' }));
      expect(
        screen.getByText(
          'Use 3–34 letters and numbers, including at least one letter.',
        ),
      ).toBeVisible();
      expect(usersApi.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    'sample_member',
    'sample-member',
    'sample.member',
    '123456',
    'hosting',
  ])('allows retaining an existing username %s', async username => {
    updateUser.mockResolvedValue({ ...user, username });
    renderPage({ username });
    expect(screen.getByText(/Your current username can stay/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Change username' }));
    expect(await screen.findByText('Username updated.')).toBeVisible();
  });

  it('changes the password when the form is submitted', async () => {
    changePassword.mockResolvedValue({ user });
    renderPage();

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-secret' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-secret' },
    });
    fireEvent.change(screen.getByLabelText('Verify password'), {
      target: { value: 'new-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => {
      expect(usersApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'old-secret',
        newPassword: 'new-secret',
        verifyPassword: 'new-secret',
      });
    });
    expect(
      await screen.findByText('Your password is now changed. Have a nice day!'),
    ).toBeVisible();
  });

  it('toggles the newsletter subscription immediately', async () => {
    updateUser.mockResolvedValue({ ...user, newsletter: true });
    renderPage();

    fireEvent.click(screen.getByLabelText('Community newsletter'));

    await waitFor(() => {
      expect(usersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ newsletter: true }),
      );
    });
  });

  it('resends confirmation when a temporary email is pending', async () => {
    resendConfirmation.mockResolvedValue(undefined);
    renderPage({ emailTemporary: 'pending@example.test' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Resend confirmation' }),
    );

    expect(await screen.findByText('Confirmation email resent.')).toBeVisible();
  });

  it('initialises profile removal after confirmation', async () => {
    removeProfile.mockResolvedValue({ message: 'Removal started.' });
    renderPage();

    fireEvent.click(screen.getByLabelText('Yes, I want to remove my profile'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove profile' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }));

    expect(await screen.findByText('Removal started.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Cancel account deletion' }),
    ).toBeVisible();
  });

  it('reports email change failures', async () => {
    updateUser.mockRejectedValue({
      response: { data: { message: 'Email already taken.' } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'taken@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change email' }));

    expect(await screen.findByText('Email already taken.')).toBeVisible();
  });

  it('reports username change failures', async () => {
    updateUser.mockRejectedValue({
      response: { data: { message: 'Username unavailable.' } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'takenname' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change username' }));

    expect(await screen.findByText('Username unavailable.')).toBeVisible();
  });

  it('reports password change failures', async () => {
    changePassword.mockRejectedValue({
      response: { data: { message: 'Current password incorrect.' } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'wrong' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-secret' },
    });
    fireEvent.change(screen.getByLabelText('Verify password'), {
      target: { value: 'new-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('Current password incorrect.'),
    ).toBeVisible();
  });

  it('reports newsletter update failures', async () => {
    updateUser.mockRejectedValue({
      response: { data: { message: 'Subscription update failed.' } },
    });
    renderPage();

    fireEvent.click(screen.getByLabelText('Community newsletter'));

    expect(
      await screen.findByText('Subscription update failed.'),
    ).toBeVisible();
  });

  it('reports resend confirmation failures', async () => {
    resendConfirmation.mockRejectedValue({
      response: { data: { message: 'Unable to resend email.' } },
    });
    renderPage({ emailTemporary: 'pending@example.test' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Resend confirmation' }),
    );

    expect(await screen.findByText('Unable to resend email.')).toBeVisible();
  });

  it('reports profile removal failures', async () => {
    removeProfile.mockRejectedValue({
      response: { data: { message: 'Removal failed.' } },
    });
    renderPage();

    fireEvent.click(screen.getByLabelText('Yes, I want to remove my profile'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove profile' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }));

    expect(await screen.findByText('Removal failed.')).toBeVisible();
  });

  it('uses fallback messages when account requests have no response body', async () => {
    updateUser.mockRejectedValue(new Error('network'));
    changePassword.mockRejectedValue(new Error('network'));
    resendConfirmation.mockRejectedValue(new Error('network'));
    renderPage({ emailTemporary: 'pending@example.test' });

    fireEvent.click(screen.getByRole('button', { name: 'Change email' }));
    expect(await screen.findByText('Something went wrong.')).toBeVisible();
    expect(usersApi.update).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Change username' }));
    expect(await screen.findByText('Something went wrong')).toBeVisible();
    expect(usersApi.update).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByLabelText('Community newsletter'));
    await waitFor(() => expect(usersApi.update).toHaveBeenCalledTimes(3));

    fireEvent.click(
      screen.getByRole('button', { name: 'Resend confirmation' }),
    );
    await waitFor(() => {
      expect(usersApi.resendEmailConfirmation).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText(
        'Password not changed due to an error, try again.',
      ),
    ).toBeVisible();
  });

  it('uses blank inputs and a default removal success message', async () => {
    removeProfile.mockResolvedValue({});
    // This legacy API fixture deliberately omits required UserProfile fields.
    const incompleteProfile = malformedFixture(user, {
      email: undefined,
      username: undefined,
    });
    renderUser(incompleteProfile);

    expect(screen.getByLabelText('Email Address')).toHaveValue('');
    expect(screen.getByLabelText('Username')).toHaveValue('');

    fireEvent.click(screen.getByLabelText('Yes, I want to remove my profile'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove profile' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }));

    expect(await screen.findByText('Success.')).toBeVisible();
  });

  it('uses a fallback message when profile removal cannot start', async () => {
    removeProfile.mockRejectedValue(new Error('network'));
    renderPage();

    fireEvent.click(screen.getByLabelText('Yes, I want to remove my profile'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove profile' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }));

    expect(
      await screen.findByText(
        'Something went wrong while initializing profile removal, try again.',
      ),
    ).toBeVisible();
  });

  it('does not remove the profile before confirmation', () => {
    renderPage();

    const button = screen.getByRole('button', { name: 'Remove profile' });
    button.removeAttribute('disabled');
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );

    expect(usersApi.removeProfile).not.toHaveBeenCalled();
  });
});

it.each([true, false])(
  'respects username-change eligibility (%s)',
  usernameUpdateAllowed => {
    renderPage({ usernameUpdateAllowed });
    const input = screen.getByLabelText('Username');
    const button = screen.getByRole('button', { name: 'Change username' });
    if (usernameUpdateAllowed) {
      expect(input).toBeEnabled();
      expect(button).toBeEnabled();
    } else {
      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
    }
  },
);

describe('pending account deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfileRemovalStatus.mockResolvedValue({ pending: true });
  });

  it('shows an existing request and cancels it explicitly', async () => {
    let complete!: (status: usersApi.ProfileRemovalStatus) => void;
    cancelProfileRemoval.mockReturnValue(
      new Promise(resolve => {
        complete = resolve;
      }),
    );
    renderPage();
    const cancel = await screen.findByRole('button', {
      name: 'Cancel account deletion',
    });
    expect(usersApi.cancelProfileRemoval).not.toHaveBeenCalled();
    fireEvent.click(cancel);
    expect(cancel).toBeDisabled();
    complete({ pending: false });
    expect(
      await screen.findByText(
        'Account deletion cancelled. Your account will be kept.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Cancel account deletion' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Yes, I want to remove my profile'),
    ).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Yes, I want to remove my profile'));
    expect(
      screen.getByRole('button', { name: 'Remove profile' }),
    ).toBeEnabled();
  });

  it.each([
    [
      { response: { data: { message: 'Please retry cancellation.' } } },
      'Please retry cancellation.',
    ],
    [
      new Error('network'),
      'Could not cancel account deletion. Please try again.',
    ],
  ])(
    'retains the pending request on cancellation failure (%s)',
    async (error, message) => {
      cancelProfileRemoval.mockRejectedValue(error);
      renderPage();
      fireEvent.click(
        await screen.findByRole('button', { name: 'Cancel account deletion' }),
      );
      expect(await screen.findByText(message)).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Cancel account deletion' }),
      ).toBeEnabled();
    },
  );

  it('reports unavailable status', async () => {
    getProfileRemovalStatus.mockRejectedValue(new Error('network'));
    renderPage();
    expect(
      await screen.findByText(
        'Could not check pending account deletion. Please reload to try again.',
      ),
    ).toBeVisible();
  });

  it('ignores status responses after unmounting', async () => {
    let complete!: (status: usersApi.ProfileRemovalStatus) => void;
    getProfileRemovalStatus.mockReturnValue(
      new Promise(resolve => {
        complete = resolve;
      }),
    );
    const { unmount } = renderPage();
    unmount();
    complete({ pending: true });
    await Promise.resolve();
  });

  it('ignores status failures after unmounting', async () => {
    let fail!: (error: Error) => void;
    getProfileRemovalStatus.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    const { unmount } = renderPage();
    unmount();
    fail(new Error('network'));
    await Promise.resolve();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfileEditAccount from '@/modules/users/client/components/ProfileEditAccount.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/users/client/api/users.api');
const updateUser = jest.mocked(usersApi.update);
const changePassword = jest.mocked(usersApi.changePassword);
const resendConfirmation = jest.mocked(usersApi.resendEmailConfirmation);
const removeProfile = jest.mocked(usersApi.removeProfile);
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <section>{children}</section>
    ),
  }),
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (values?.email) {
        return key.replace('{{email}}', String(values.email));
      }

      return key;
    },
  }),
}));

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
  });

  it('renders account settings sections', () => {
    renderPage();

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByText(/three months after joining/)).toBeVisible();
    expect(screen.getByText(/at least one letter or number/)).toBeVisible();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByText('Community newsletter')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Download your data' }),
    ).toHaveAttribute('href', '/api/users/export');
    expect(
      screen.getByLabelText('Yes, I want to remove my profile'),
    ).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }));

    expect(await screen.findByText('Removal started.')).toBeVisible();
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
      target: { value: 'taken-name' },
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
      await screen.findByText('Password not changed due error, try again.'),
    ).toBeVisible();
  });

  it('uses blank inputs and a default removal success message', async () => {
    removeProfile.mockResolvedValue({});
    // This legacy API fixture deliberately omits required UserProfile fields.
    const incompleteProfile = {
      ...user,
      email: undefined,
      username: undefined,
    } as unknown as UserProfile;
    renderUser(incompleteProfile);

    expect(screen.getByLabelText('Email Address')).toHaveValue('');
    expect(screen.getByLabelText('Username')).toHaveValue('');

    fireEvent.click(screen.getByLabelText('Yes, I want to remove my profile'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }));

    expect(await screen.findByText('Success.')).toBeVisible();
  });

  it('uses a fallback message when profile removal cannot start', async () => {
    removeProfile.mockRejectedValue(new Error('network'));
    renderPage();

    fireEvent.click(screen.getByLabelText('Yes, I want to remove my profile'));
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

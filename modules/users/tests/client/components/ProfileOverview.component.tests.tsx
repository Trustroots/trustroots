import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';

import ProfileOverview from '@/modules/users/client/components/ProfileOverview.component';
import type Avatar from '@/modules/users/client/components/Avatar.component';
import type ProfileViewBasics from '@/modules/users/client/components/ProfileViewBasics';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/users/client/components/Avatar.component', () => {
  function MockAvatar({
    onClick,
    size,
    user,
  }: React.ComponentProps<typeof Avatar>) {
    return (
      <div data-testid={`avatar-${size}`} onClick={onClick}>
        {`Avatar ${size} ${user.displayName}`}
      </div>
    );
  }

  return MockAvatar;
});

jest.mock('@/modules/users/client/components/ProfileViewBasics', () => {
  function MockProfileViewBasics({
    profile,
  }: React.ComponentProps<typeof ProfileViewBasics>) {
    return (
      <section data-testid="profile-basics">{profile.displayName}</section>
    );
  }

  return MockProfileViewBasics;
});

describe('<ProfileOverview />', () => {
  const profile: UserProfile = {
    _id: 'user-1',
    avatarSource: 'none',
    displayName: 'Alice Example',
    username: 'alice',
  };

  it('renders profile basics and opens the large avatar modal', async () => {
    render(<ProfileOverview isSelf={false} profile={profile} />);

    expect(screen.getByTestId('profile-basics')).toHaveTextContent(
      'Alice Example',
    );
    expect(screen.getByTestId('avatar-256')).toHaveTextContent(
      'Avatar 256 Alice Example',
    );

    fireEvent.click(screen.getByTestId('avatar-256'));

    expect(await screen.findByTestId('avatar-512')).toHaveTextContent(
      'Avatar 512 Alice Example',
    );

    fireEvent.click(screen.getByTestId('avatar-512'));

    await waitFor(() =>
      expect(screen.queryByTestId('avatar-512')).not.toBeInTheDocument(),
    );
  });

  it('links the owner’s placeholder avatar to photo editing', () => {
    render(
      <ProfileOverview
        profile={{
          ...profile,
          avatarSource: 'gravatar',
          avatarUploaded: false,
        }}
        isSelf
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Edit profile photo' }),
    ).toHaveAttribute('href', '/profile/edit/photo');
  });

  it('uses the username to label the photo control when the name is missing', () => {
    render(
      <ProfileOverview
        isSelf={false}
        profile={{ ...profile, displayName: '' }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Open profile picture of alice' }),
    ).toBeInTheDocument();
  });

  it('links the selected placeholder after a previous upload', () => {
    render(
      <ProfileOverview profile={{ ...profile, avatarUploaded: true }} isSelf />,
    );

    expect(
      screen.getByRole('link', { name: 'Edit profile photo' }),
    ).toHaveAttribute('href', '/profile/edit/photo');
  });

  it('keeps an uploaded profile photo expandable for its owner', async () => {
    render(
      <ProfileOverview
        profile={{ ...profile, avatarSource: 'local', avatarUploaded: true }}
        isSelf
      />,
    );

    expect(
      screen.queryByRole('link', { name: 'Edit profile photo' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('avatar-256'));
    expect(await screen.findByTestId('avatar-512')).toBeInTheDocument();
  });
});

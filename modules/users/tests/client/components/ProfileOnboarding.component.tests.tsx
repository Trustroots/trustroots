import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import AvatarNameMobile from '@/modules/users/client/components/AvatarNameMobile.component';
import ConfirmEmailNotification from '@/modules/users/client/components/ConfirmEmailNotification.component';
import HostingAndMeetPanel from '@/modules/users/client/components/HostingAndMeetPanel.component';
import UserDoesNotExist from '@/modules/users/client/components/UserDoesNotExist.component';
import Welcome from '@/modules/users/client/components/Welcome.component';
import type Avatar from '@/modules/users/client/components/Avatar.component';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/users/client/components/Avatar.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAvatar({
    size,
    user,
  }: Pick<React.ComponentProps<typeof Avatar>, 'size' | 'user'>) {
    return <span>{`Avatar ${size} ${user.displayName}`}</span>;
  }

  return MockAvatar;
});

const sparseProfile = {
  _id: 'user-1',
  username: 'member-one',
  avatarSource: 'none',
} as unknown as UserProfile & { displayUsername?: string };

describe('profile onboarding components', () => {
  it('invites new members to complete their profile', () => {
    render(<Welcome />);

    expect(
      screen.getByRole('heading', { name: 'Hey, welcome!' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Fill your profile' }),
    ).toHaveAttribute('href', '/profile/edit');
  });

  it('links unconfirmed members to email settings', () => {
    render(<ConfirmEmailNotification />);

    expect(
      screen.getByText(/profile will not be visible/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'email settings' }),
    ).toHaveAttribute('href', '/profile/edit/account');
  });

  it('points members to hosting location editing', () => {
    render(<HostingAndMeetPanel />);

    expect(
      screen.getByRole('button', { name: 'Modify your hosting location' }),
    ).toHaveAttribute('href', '/offer/host');
  });

  it('guides missing profiles back to member search and map search', () => {
    render(<UserDoesNotExist />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The person you are looking for is not available.',
    );
    expect(screen.getByRole('link', { name: 'Find people' })).toHaveAttribute(
      'href',
      '/search/members',
    );
    expect(screen.getByRole('link', { name: 'Map search' })).toHaveAttribute(
      'href',
      '/search',
    );
  });

  it('renders mobile avatar identity and toggles the large avatar class', () => {
    const profile: UserProfile & { displayUsername: string } = {
      _id: 'user-1',
      username: 'member-one',
      displayName: 'Member One',
      avatarSource: 'local',
      avatarUploaded: true,
      displayUsername: 'Member One',
      tagline: 'Hosting guests in Northport',
    };
    render(<AvatarNameMobile profile={profile} isSelf />);

    expect(screen.getByRole('heading', { name: 'Member One' })).toBeVisible();
    expect(screen.getByText('@Member One')).toBeVisible();
    expect(screen.getByText('Hosting guests in Northport')).toBeVisible();

    const avatarButton = screen.getByText('Avatar 512 Member One').closest('a');

    expect(avatarButton).not.toHaveClass('profile-avatar-lg');

    fireEvent.click(avatarButton!);

    expect(avatarButton).toHaveClass('profile-avatar-lg');
  });

  it('renders mobile avatar identity without optional display fields', () => {
    // Regression fixture deliberately omits the required displayName field.
    render(<AvatarNameMobile profile={sparseProfile} />);

    expect(screen.getByText('@member-one')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Member One' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Hosting guests in Northport'),
    ).not.toBeInTheDocument();
  });

  it('links an owner’s mobile placeholder to photo editing', () => {
    const profile: UserProfile = {
      _id: 'user-1',
      username: 'member-one',
      displayName: 'Member One',
      avatarSource: 'none',
      avatarUploaded: false,
    };
    render(<AvatarNameMobile profile={profile} isSelf />);

    expect(
      screen.getByRole('link', { name: 'Edit profile photo' }),
    ).toHaveAttribute('href', '/profile/edit/photo');
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import AvatarNameMobile from '@/modules/users/client/components/AvatarNameMobile.component';
import ConfirmEmailNotification from '@/modules/users/client/components/ConfirmEmailNotification.component';
import HostingAndMeetPanel from '@/modules/users/client/components/HostingAndMeetPanel.component';
import UserDoesNotExist from '@/modules/users/client/components/UserDoesNotExist.component';
import Welcome from '@/modules/users/client/components/Welcome.component';

jest.mock('@/modules/users/client/components/Avatar.component', () => {
  function MockAvatar({ size, user }) {
    return <span>{`Avatar ${size} ${user.displayName}`}</span>;
  }

  MockAvatar.propTypes = {
    size: () => null,
    user: () => null,
  };

  return MockAvatar;
});

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
    render(
      <AvatarNameMobile
        profile={{
          avatarSource: 'local',
          avatarUploaded: true,
          displayName: 'Alice Example',
          displayUsername: 'Alice',
          tagline: 'Hosting cyclists in Lisbon',
          username: 'alice',
        }}
        isSelf
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Alice Example' }),
    ).toBeVisible();
    expect(screen.getByText('@Alice')).toBeVisible();
    expect(screen.getByText('Hosting cyclists in Lisbon')).toBeVisible();

    const avatarButton = screen
      .getByText('Avatar 512 Alice Example')
      .closest('a');

    expect(avatarButton).not.toHaveClass('profile-avatar-lg');

    fireEvent.click(avatarButton);

    expect(avatarButton).toHaveClass('profile-avatar-lg');
  });

  it('renders mobile avatar identity without optional display fields', () => {
    render(
      <AvatarNameMobile
        profile={{
          avatarSource: 'none',
          username: 'alice',
        }}
      />,
    );

    expect(screen.getByText('@alice')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Alice Example' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Hosting cyclists in Lisbon'),
    ).not.toBeInTheDocument();
  });

  it('links an owner’s mobile placeholder to photo editing', () => {
    render(
      <AvatarNameMobile
        profile={{
          avatarSource: 'none',
          avatarUploaded: false,
          username: 'alice',
        }}
        isSelf
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Edit profile photo' }),
    ).toHaveAttribute('href', '/profile/edit/photo');
  });
});

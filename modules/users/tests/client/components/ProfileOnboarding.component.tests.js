import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import AvatarNameMobile from '@/modules/users/client/components/AvatarNameMobile.component';
import ConfirmEmailNotification from '@/modules/users/client/components/ConfirmEmailNotification.component';
import DownloadProfile from '@/modules/users/client/components/DownloadProfile.component';
import HostingAndMeetPanel from '@/modules/users/client/components/HostingAndMeetPanel.component';
import InterfaceLanguagePanel from '@/modules/users/client/components/InterfaceLanguagePanel.component';
import UserDoesNotExist from '@/modules/users/client/components/UserDoesNotExist.component';
import Welcome from '@/modules/users/client/components/Welcome.component';

jest.mock('@/modules/core/client/components/LanguageSwitch', () => {
  function MockLanguageSwitch({ buttonStyle, saveToAPI }) {
    return (
      <button
        data-button-style={buttonStyle}
        data-save-to-api={String(saveToAPI)}
        type="button"
      >
        Language switch
      </button>
    );
  }

  MockLanguageSwitch.propTypes = {
    buttonStyle: () => null,
    saveToAPI: () => null,
  };

  return MockLanguageSwitch;
});

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

  it('builds profile data download links for the current member', () => {
    render(<DownloadProfile userId="user-1" username="alice" />);

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/api/users/alice',
    );
    expect(screen.getByRole('link', { name: 'Contacts' })).toHaveAttribute(
      'href',
      '/api/contacts/user-1',
    );
    expect(screen.getByRole('link', { name: 'Hosting offer' })).toHaveAttribute(
      'href',
      '/api/offers-by/user-1',
    );
  });

  it('renders interface language controls with API saving enabled', () => {
    render(<InterfaceLanguagePanel />);

    expect(
      screen.getByRole('button', { name: 'Language switch' }),
    ).toHaveAttribute('data-button-style', 'primary');
    expect(
      screen.getByRole('button', { name: 'Language switch' }),
    ).toHaveAttribute('data-save-to-api', 'true');
    expect(
      screen.getByRole('link', { name: 'You can help us out!' }),
    ).toHaveAttribute('href', '/volunteering');
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
          avatarSource: 'none',
          displayName: 'Alice Example',
          displayUsername: 'Alice',
          tagline: 'Hosting cyclists in Lisbon',
          username: 'alice',
        }}
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
});

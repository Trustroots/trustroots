import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ProfileEditPage from '@/modules/users/client/components/ProfileEditPage.component';

const user = { _id: 'user-1', username: 'ada' };

describe('ProfileEditPage', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders edit navigation and child content for the about tab', () => {
    window.history.pushState({}, '', '/profile/edit');

    render(
      <ProfileEditPage user={user}>
        <p>Edit form content</p>
      </ProfileEditPage>,
    );

    expect(screen.getByText('Edit form content')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Edit profile' })[0],
    ).toHaveAttribute('href', '/profile/edit');
    expect(
      screen.getAllByRole('link', { name: 'Locations' })[0],
    ).toHaveAttribute('href', '/profile/edit/locations');
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute(
      'href',
      '/profile/ada',
    );
  });

  it('highlights the active tab from the current path', () => {
    window.history.pushState({}, '', '/profile/edit/account');

    render(
      <ProfileEditPage user={user}>
        <p>Account settings</p>
      </ProfileEditPage>,
    );

    expect(
      screen.getAllByRole('link', { name: 'Account' })[0].closest('li'),
    ).toHaveClass('active');
  });
});

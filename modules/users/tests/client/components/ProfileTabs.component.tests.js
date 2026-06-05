import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ProfileTabs from '@/modules/users/client/components/ProfileTabs.component';
import { $on } from '@/modules/core/client/services/angular-compat';
import { getCount } from '@/modules/experiences/client/api/experiences.api';

jest.mock('@/modules/core/client/services/angular-compat');
jest.mock('@/modules/experiences/client/api/experiences.api');

describe('<ProfileTabs />', () => {
  let stateChangeHandler;

  beforeEach(() => {
    stateChangeHandler = null;
    $on.mockImplementation((eventName, handler) => {
      stateChangeHandler = handler;
      return jest.fn();
    });
    getCount.mockResolvedValue({ count: 2, hasPending: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile tabs with contact and experience counts', async () => {
    render(
      <ProfileTabs
        contactsCount={3}
        initialPathName="profile.about"
        isExperiencesEnabled
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    expect(screen.getByRole('tab', { name: 'About' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByRole('tab', { name: '3 contacts' })).toHaveAttribute(
      'href',
      '/profile/alice/contacts',
    );
    expect(
      screen.getByRole('tab', { name: 'About' }).closest('li'),
    ).toHaveClass('active');

    await waitFor(() => expect(getCount).toHaveBeenCalledWith('user-1'));

    expect(screen.getByRole('tab', { name: '2 experiences' })).toHaveAttribute(
      'href',
      '/profile/alice/experiences',
    );
    expect(screen.getByText('2')).toHaveClass('badge');
  });

  it('updates the active tab when Angular reports a route change', () => {
    render(
      <ProfileTabs
        contactsCount={1}
        initialPathName="profile.about"
        isExperiencesEnabled={false}
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    act(() => {
      stateChangeHandler({}, { name: 'profile.contacts' });
    });

    expect(
      screen.getByRole('tab', { name: '1 contacts' }).closest('li'),
    ).toHaveClass('active');
    expect(getCount).not.toHaveBeenCalled();
  });

  it('hides private tabs for other members when counts are unavailable', () => {
    render(
      <ProfileTabs
        contactsCount={0}
        initialPathName="profile.about"
        isExperiencesEnabled={false}
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    expect(
      screen.queryByRole('tab', { name: '0 contacts' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /experiences/i }),
    ).not.toBeInTheDocument();
    expect($on).toHaveBeenCalledWith(
      '$stateChangeSuccess',
      expect.any(Function),
    );
  });
});

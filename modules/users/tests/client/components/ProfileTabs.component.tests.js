import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ProfileTabs from '@/modules/users/client/components/ProfileTabs.component';
import { getCount } from '@/modules/experiences/client/api/experiences.api';

jest.mock('@/modules/experiences/client/api/experiences.api');

describe('<ProfileTabs />', () => {
  beforeEach(() => {
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

  it('updates the active tab when the route prop changes', () => {
    const { rerender } = render(
      <ProfileTabs
        contactsCount={1}
        initialPathName="profile.about"
        isExperiencesEnabled={false}
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    rerender(
      <ProfileTabs
        activePathName="profile.contacts"
        contactsCount={1}
        initialPathName="profile.about"
        isExperiencesEnabled={false}
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

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
  });

  it('shows an experiences notification dot when experiences are pending', async () => {
    getCount.mockResolvedValue({ count: 5, hasPending: true });

    render(
      <ProfileTabs
        contactsCount={2}
        initialPathName="profile.about"
        isExperiencesEnabled
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    await waitFor(() => expect(getCount).toHaveBeenCalledTimes(1));

    const expTab = screen
      .getByRole('tab', {
        name: /experiences/i,
      })
      .closest('li');

    expect(expTab.querySelector('div')).toBeInTheDocument();
    expect(screen.getByText('5')).toHaveClass('badge');
  });

  it('hides unavailable experience tabs without pending notification', async () => {
    getCount.mockResolvedValue({ count: -1, hasPending: false });

    render(
      <ProfileTabs
        contactsCount={2}
        initialPathName="profile.about"
        isExperiencesEnabled
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    await waitFor(() => expect(getCount).toHaveBeenCalledTimes(1));

    expect(
      screen.queryByRole('tab', { name: /experiences/i }),
    ).not.toBeInTheDocument();
  });

  it('shows private tabs for own profile even without counts', async () => {
    render(
      <ProfileTabs
        contactsCount={0}
        initialPathName="profile.about"
        isExperiencesEnabled
        isOWnProfile
        userId="user-1"
        username="alice"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: '0 contacts' }),
      ).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: '2 experiences' }),
      ).toBeInTheDocument(),
    );
  });

  it('handles route updates that activate the experiences tab', async () => {
    const { rerender } = render(
      <ProfileTabs
        contactsCount={1}
        initialPathName="profile.about"
        isExperiencesEnabled
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    rerender(
      <ProfileTabs
        activePathName="profile.experiences.list"
        contactsCount={1}
        initialPathName="profile.about"
        isExperiencesEnabled
        isOWnProfile={false}
        userId="user-1"
        username="alice"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: /2 experiences/ }).closest('li'),
      ).toHaveClass('active'),
    );
  });
});

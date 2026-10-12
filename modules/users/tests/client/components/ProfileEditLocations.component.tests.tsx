import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfileEditLocations from '@/modules/users/client/components/ProfileEditLocations.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import type { UserProfile } from '@/modules/users/client/types';
import type LocationInput from '@/modules/core/client/components/LocationInput.component';

jest.mock('@/modules/users/client/api/users.api');
const updateUser = jest.mocked(usersApi.update);
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => (
      <section>{children}</section>
    ),
  }),
);
jest.mock('@/modules/core/client/components/LocationInput.component', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockLocationInput({
    id,
    onChange,
    placeholder,
    value,
  }: React.ComponentProps<typeof LocationInput>) {
    return (
      <input
        aria-label={placeholder}
        id={id}
        onChange={event => onChange(event.target.value)}
        value={value || ''}
      />
    );
  }

  return MockLocationInput;
});
jest.mock(
  '@/modules/users/client/components/HostingAndMeetPanel.component',
  () => ({
    __esModule: true,
    default: () => <div>Hosting and meet panel</div>,
  }),
);

const user: UserProfile = {
  _id: 'user-1',
  username: 'member-one',
  displayName: 'Member One',
  locationLiving: '',
  locationFrom: '',
};

function renderPage(overrides: Partial<UserProfile> = {}) {
  const profile: UserProfile = { ...user, ...overrides };

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
      <ProfileEditLocations user={profile} />
    </AppProviders>,
  );
}

describe('ProfileEditLocations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders location fields and the hosting panel', () => {
    renderPage();

    expect(screen.getAllByLabelText('City, Country')).toHaveLength(2);
    expect(screen.getByText('Hosting and meet panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves location changes', async () => {
    updateUser.mockResolvedValue({
      ...user,
      locationLiving: 'London, United Kingdom',
    });
    renderPage();

    fireEvent.change(screen.getAllByLabelText('City, Country')[0], {
      target: { value: 'London, United Kingdom' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          locationLiving: 'London, United Kingdom',
        }),
      );
    });
    expect(await screen.findByText('Profile updated.')).toBeVisible();
  });

  it('updates the origin location and shows a fallback error', async () => {
    updateUser.mockRejectedValue(new Error('network'));
    renderPage();

    fireEvent.change(screen.getAllByLabelText('City, Country')[1], {
      target: { value: 'Paris, France' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Something went wrong. Please try again!'),
    ).toBeVisible();
  });
});

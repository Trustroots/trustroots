import React, { type PropsWithChildren } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Team from '@/modules/pages/client/components/Team.component';
import { getVolunteers } from '@/modules/pages/client/api/volunteers.api';

jest.mock('@/modules/pages/client/api/volunteers.api');

jest.mock('@/modules/core/client/components/Board.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }
  return MockBoard;
});

const loggedInUser: NonNullable<React.ComponentProps<typeof Team>['user']> = {
  _id: 'member-1',
  username: 'sample-member',
  displayName: 'Sample Member',
};
const getVolunteersMock = jest.mocked(getVolunteers);

afterEach(() => {
  jest.clearAllMocks();
});

describe('<Team />', () => {
  it('renders fetched volunteers and alumni', async () => {
    getVolunteersMock.mockResolvedValueOnce({
      volunteers: [
        { _id: 'v1', username: 'sample-volunteer', firstName: 'Alex' },
      ],
      alumni: [
        { _id: 'alumni-1', username: 'sample-alumnus', firstName: 'Sam' },
      ],
    });

    render(<Team user={loggedInUser} />);

    expect(await screen.findByRole('link', { name: /Alex/ })).toHaveAttribute(
      'href',
      '/profile/sample-volunteer',
    );
    expect(screen.getByRole('link', { name: 'Sam' })).toHaveAttribute(
      'href',
      '/profile/sample-alumnus',
    );
    expect(screen.getByText('Trustroots Team')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alex' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/users/v1/avatar?size=256'),
    );
  });

  it('shows loading state while volunteers are being fetched', async () => {
    let resolveVolunteers!: (
      response: Awaited<ReturnType<typeof getVolunteers>>,
    ) => void;
    const pending = new Promise<Awaited<ReturnType<typeof getVolunteers>>>(
      resolve => {
        resolveVolunteers = resolve;
      },
    );
    getVolunteersMock.mockReturnValueOnce(pending);

    render(<Team user={loggedInUser} />);

    expect(await screen.findByText('Wait a moment…')).toBeInTheDocument();

    resolveVolunteers({
      volunteers: [
        { _id: 'volunteer-1', username: 'sample-volunteer', firstName: 'Alex' },
      ],
      alumni: [],
    });

    expect(await screen.findByRole('link', { name: /Alex/ })).toHaveAttribute(
      'href',
      '/profile/sample-volunteer',
    );
  });

  it('shows a join button for logged-out visitors', async () => {
    getVolunteersMock.mockResolvedValueOnce({ volunteers: [], alumni: [] });

    render(<Team user={null} />);

    await waitFor(() => expect(getVolunteersMock).toHaveBeenCalled());

    expect(
      screen.getByRole('link', { name: 'Join Trustroots' }),
    ).toHaveAttribute('href', '/signup');
  });

  it('uses username and fallback avatar for logged-out volunteer and alumni entries', async () => {
    getVolunteersMock.mockResolvedValueOnce({
      volunteers: [{ _id: 'volunteer-2', username: 'sample-helper' }],
      alumni: [{ _id: 'alumni-2', username: 'sample-alumnus' }],
    });

    render(<Team user={null} />);

    expect(
      await screen.findByRole('link', { name: /sample-helper/ }),
    ).toHaveAttribute('href', '/profile/sample-helper');
    expect(screen.getByRole('img', { name: 'sample-helper' })).toHaveAttribute(
      'src',
      '/img/avatar.png',
    );
    expect(
      screen.getByRole('link', { name: 'sample-alumnus' }),
    ).toHaveAttribute('href', '/profile/sample-alumnus');
  });
});

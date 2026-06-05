import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Team from '@/modules/pages/client/components/Team.component';
import { getVolunteers } from '@/modules/pages/client/api/volunteers.api';

jest.mock('@/modules/pages/client/api/volunteers.api');

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = require('react');
  function MockBoard({ children }) {
    return <div>{children}</div>;
  }
  MockBoard.propTypes = { children: () => null };
  return MockBoard;
});

const loggedInUser = {
  _id: 'me',
  username: 'me',
  displayName: 'Current User',
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('<Team />', () => {
  it('renders fetched volunteers and alumni', async () => {
    getVolunteers.mockResolvedValueOnce({
      volunteers: [{ _id: 'v1', username: 'alice', firstName: 'Alice' }],
      alumni: [{ _id: 'a1', username: 'bob', firstName: 'Bob' }],
    });

    render(<Team user={loggedInUser} />);

    expect(await screen.findByRole('link', { name: /Alice/ })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute(
      'href',
      '/profile/bob',
    );
    expect(screen.getByText('Trustroots Team')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alice' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/users/v1/avatar?size=256'),
    );
  });

  it('shows loading state while volunteers are being fetched', async () => {
    let resolveVolunteers;
    const pending = new Promise(resolve => {
      resolveVolunteers = resolve;
    });
    getVolunteers.mockReturnValueOnce(pending);

    render(<Team user={loggedInUser} />);

    expect(await screen.findByText('Wait a moment…')).toBeInTheDocument();

    resolveVolunteers({
      volunteers: [{ _id: 'v1', username: 'alice', firstName: 'Alice' }],
      alumni: [],
    });

    expect(await screen.findByRole('link', { name: /Alice/ })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
  });

  it('shows a join button for logged-out visitors', async () => {
    getVolunteers.mockResolvedValueOnce({ volunteers: [], alumni: [] });

    render(<Team user={null} />);

    await waitFor(() => expect(getVolunteers).toHaveBeenCalled());

    expect(
      screen.getByRole('link', { name: 'Join Trustroots' }),
    ).toHaveAttribute('href', '/signup');
  });
});

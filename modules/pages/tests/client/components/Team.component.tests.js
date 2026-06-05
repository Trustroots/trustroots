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

afterEach(() => {
  jest.clearAllMocks();
});

describe('<Team />', () => {
  it('renders fetched volunteers and alumni', async () => {
    getVolunteers.mockResolvedValueOnce({
      volunteers: [{ _id: 'v1', username: 'alice', firstName: 'Alice' }],
      alumni: [{ _id: 'a1', username: 'bob', firstName: 'Bob' }],
    });

    render(<Team user={{ _id: 'me' }} />);

    expect(await screen.findByRole('link', { name: /Alice/ })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveAttribute(
      'href',
      '/profile/bob',
    );
    expect(screen.getByText('Trustroots Team')).toBeInTheDocument();
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

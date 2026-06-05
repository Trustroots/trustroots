import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Home, {
  getSignupUrl,
} from '@/modules/pages/client/components/Home.component';
import * as circlesAPI from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');

jest.mock('@/modules/core/client/services/angular-compat', () => ({
  getRouteParams: () => ({}),
}));

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = require('react');
  function MockBoard({ children }) {
    return <div>{children}</div>;
  }
  MockBoard.propTypes = { children: () => null };
  return MockBoard;
});

jest.mock('@/modules/core/client/components/Screenshot.js', () => {
  const React = require('react');
  function MockScreenshot() {
    return <div>screenshot</div>;
  }
  return MockScreenshot;
});

jest.mock('@/modules/core/client/components/BoardCredits.js', () => {
  const React = require('react');
  function MockBoardCredits() {
    return <div>board-credits</div>;
  }
  return MockBoardCredits;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('getSignupUrl', () => {
  it('returns plain signup url without a circle', () => {
    expect(getSignupUrl()).toBe('/signup');
  });

  it('appends the circle slug when present', () => {
    expect(getSignupUrl('hitchhikers')).toBe('/signup?tribe=hitchhikers');
  });
});

describe('<Home />', () => {
  it('renders the intro and join button for logged-out visitors', async () => {
    circlesAPI.read.mockResolvedValueOnce([]);

    render(<Home user={null} />);

    expect(screen.getByText('How does it work?')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Join Trustroots now' }),
    ).toHaveAttribute('href', '/signup');
  });

  it('renders fetched circles', async () => {
    circlesAPI.read.mockResolvedValueOnce([
      { _id: 'c1', slug: 'hitchhikers', label: 'Hitchhikers' },
    ]);

    render(<Home user={{ _id: 'me' }} />);

    expect(await screen.findByText('Hitchhikers')).toBeInTheDocument();
    expect(circlesAPI.read).toHaveBeenCalledWith({ limit: 3 });
  });
});

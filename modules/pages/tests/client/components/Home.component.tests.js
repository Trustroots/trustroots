import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Home, {
  getSignupUrl,
} from '@/modules/pages/client/components/Home.component';
import * as circlesAPI from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');

const mockGetRouteParams = jest.fn();

jest.mock('@/modules/core/client/services/angular-compat', () => ({
  getRouteParams: () => mockGetRouteParams(),
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
    mockGetRouteParams.mockReturnValue({});

    render(<Home user={null} />);

    expect(await screen.findByText('How does it work?')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'Join Trustroots now' }),
    ).toHaveAttribute('href', '/signup');
  });

  it('uses compact board height on small screens', async () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    circlesAPI.read.mockResolvedValueOnce([]);
    mockGetRouteParams.mockReturnValue({});
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 480,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 640,
    });

    render(<Home user={null} />);

    expect(await screen.findByText('How does it work?')).toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('renders fetched circles', async () => {
    circlesAPI.read.mockResolvedValueOnce([
      { _id: 'c1', slug: 'hitchhikers', label: 'Hitchhikers' },
    ]);
    mockGetRouteParams.mockReturnValue({});

    render(
      <Home
        user={{
          _id: 'me',
          username: 'me',
          displayName: 'Current User',
        }}
      />,
    );

    expect(await screen.findByText('Hitchhikers')).toBeInTheDocument();
    expect(circlesAPI.read).toHaveBeenCalledWith({ limit: 3 });
  });

  it('prepends a circle from route params when missing from first response', async () => {
    circlesAPI.read.mockResolvedValueOnce([
      { _id: 'c1', slug: 'mountainbiking', label: 'Mountain Bikers' },
    ]);
    circlesAPI.get.mockResolvedValueOnce({
      _id: 'c2',
      slug: 'hitchhikers',
      label: 'Hitchhikers',
    });
    mockGetRouteParams.mockReturnValue({ circle: 'hitchhikers' });

    render(<Home user={null} photoCredits={{}} />);

    expect(
      await screen.findByRole('link', { name: 'Hitchhikers' }),
    ).toBeInTheDocument();
    expect(circlesAPI.get).toHaveBeenCalledWith('hitchhikers');
    expect(
      await screen.findByRole('link', { name: 'Join Trustroots now' }),
    ).toHaveAttribute('href', '/signup?tribe=hitchhikers');
  });

  it('uses legacy tribe route params for circle-specific signup links', async () => {
    circlesAPI.read.mockResolvedValueOnce([
      { _id: 'c1', slug: 'cyclists', label: 'Cyclists' },
    ]);
    mockGetRouteParams.mockReturnValue({ tribe: 'cyclists' });

    render(<Home user={null} photoCredits={{}} />);

    expect(
      await screen.findByRole('link', { name: 'Join Trustroots now' }),
    ).toHaveAttribute('href', '/signup?tribe=cyclists');
    expect(circlesAPI.get).not.toHaveBeenCalled();
  });

  it('does not prepend unresolved route circles', async () => {
    circlesAPI.read.mockResolvedValueOnce([
      { _id: 'c1', slug: 'mountainbiking', label: 'Mountain Bikers' },
    ]);
    circlesAPI.get.mockResolvedValueOnce(null);
    mockGetRouteParams.mockReturnValue({ circle: 'hitchhikers' });

    render(<Home user={null} photoCredits={{}} />);

    expect(await screen.findByText('Mountain Bikers')).toBeInTheDocument();
    expect(screen.queryByText('Hitchhikers')).not.toBeInTheDocument();
    expect(circlesAPI.get).toHaveBeenCalledWith('hitchhikers');
  });

  it('does not show the top join link for logged-in users', async () => {
    circlesAPI.read.mockResolvedValueOnce([]);
    mockGetRouteParams.mockReturnValue({});

    render(
      <Home
        user={{
          _id: 'me',
          username: 'me',
          displayName: 'Current User',
        }}
      />,
    );

    expect(await screen.findByText('How does it work?')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Join Trustroots now' }),
    ).not.toBeInTheDocument();
  });
});

import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Home, {
  getSignupUrl,
} from '@/modules/pages/client/components/Home.component';
import * as circlesAPI from '@/modules/tribes/client/api/tribes.api';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');

const mockGetRouteParams = jest.fn<Record<string, string>, []>();
const mockReadCircles = jest.mocked(circlesAPI.read);
// The null response intentionally exercises the unresolved-route-circle case.
const mockGetCircle = jest.mocked(circlesAPI.get) as jest.MockedFunction<
  (slug: string) => Promise<TribeSummary | null>
>;
const circle = (id: string, slug: string, label: string): TribeSummary => ({
  _id: id,
  slug,
  label,
  count: 3,
});

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: () => mockGetRouteParams(),
}));

jest.mock('@/modules/core/client/components/Board.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }
  return MockBoard;
});

jest.mock('@/modules/core/client/components/Screenshot.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  function MockScreenshot() {
    return actualReact.createElement('div', null, 'screenshot');
  }
  return MockScreenshot;
});

jest.mock('@/modules/core/client/components/BoardCredits.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  function MockBoardCredits() {
    return actualReact.createElement('div', null, 'board-credits');
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
    mockReadCircles.mockResolvedValueOnce([]);
    mockGetRouteParams.mockReturnValue({});

    render(<Home user={null} />);

    expect(await screen.findByText('How does it work?')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'Join Trustroots now' }),
    ).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Statistics' })).toHaveAttribute(
      'href',
      '/statistics',
    );
    expect(screen.getByRole('link', { name: 'Safety' })).toHaveAttribute(
      'href',
      '/safety',
    );
    expect(screen.getByRole('link', { name: 'Volunteering' })).toHaveAttribute(
      'href',
      '/support?category=volunteering',
    );
  });

  it('uses compact board height on small screens', async () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    mockReadCircles.mockResolvedValueOnce([]);
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
    mockReadCircles.mockResolvedValueOnce([
      circle('circle-1', 'hitchhikers', 'Hitchhikers'),
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
    expect(mockReadCircles).toHaveBeenCalledWith({ limit: 3 });
  });

  it('prepends a circle from route params when missing from first response', async () => {
    mockReadCircles.mockResolvedValueOnce([
      circle('circle-1', 'mountainbiking', 'Mountain Bikers'),
    ]);
    mockGetCircle.mockResolvedValueOnce(
      circle('circle-2', 'hitchhikers', 'Hitchhikers'),
    );
    mockGetRouteParams.mockReturnValue({ circle: 'hitchhikers' });

    render(<Home user={null} photoCredits={{}} />);

    expect(
      await screen.findByRole('link', { name: 'Hitchhikers' }),
    ).toBeInTheDocument();
    expect(mockGetCircle).toHaveBeenCalledWith('hitchhikers');
    expect(
      await screen.findByRole('link', { name: 'Join Trustroots now' }),
    ).toHaveAttribute('href', '/signup?tribe=hitchhikers');
  });

  it('uses legacy tribe route params for circle-specific signup links', async () => {
    mockReadCircles.mockResolvedValueOnce([
      circle('circle-1', 'cyclists', 'Cyclists'),
    ]);
    mockGetRouteParams.mockReturnValue({ tribe: 'cyclists' });

    render(<Home user={null} photoCredits={{}} />);

    expect(
      await screen.findByRole('link', { name: 'Join Trustroots now' }),
    ).toHaveAttribute('href', '/signup?tribe=cyclists');
    expect(circlesAPI.get).not.toHaveBeenCalled();
  });

  it('does not prepend unresolved route circles', async () => {
    mockReadCircles.mockResolvedValueOnce([
      circle('circle-1', 'mountainbiking', 'Mountain Bikers'),
    ]);
    mockGetCircle.mockResolvedValueOnce(null);
    mockGetRouteParams.mockReturnValue({ circle: 'hitchhikers' });

    render(<Home user={null} photoCredits={{}} />);

    expect(await screen.findByText('Mountain Bikers')).toBeInTheDocument();
    expect(screen.queryByText('Hitchhikers')).not.toBeInTheDocument();
    expect(mockGetCircle).toHaveBeenCalledWith('hitchhikers');
  });

  it('does not show the top join link for logged-in users', async () => {
    mockReadCircles.mockResolvedValueOnce([]);
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

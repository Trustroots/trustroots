import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Statistics from '@/modules/statistics/client/components/Statistics.component';
import { get } from '@/modules/statistics/client/api/statistics.api';

jest.mock('@/modules/statistics/client/api/statistics.api');

jest.mock('@/modules/core/client/components/Board', () => {
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

describe('<Statistics />', () => {
  it('renders statistics from the api', async () => {
    get.mockResolvedValueOnce({
      data: {
        total: 12345,
        hosting: {
          total: 1000,
          percentage: 40,
          yes: 500,
          yesPercentage: 20,
          maybe: 500,
          maybePercentage: 20,
        },
        connections: [
          { network: 'facebook', count: 100, percentage: 10 },
          { network: 'nostr', count: 12, percentage: 1 },
        ],
        newsletter: { percentage: 30, count: 3000 },
        experiences: {
          total: 100,
          recommended: 80,
          notRecommended: 10,
          recent: { total: 20, recommended: 15, notRecommended: 3 },
          realLifeConnections: { total: 50, recent: 10 },
        },
      },
    });

    render(<Statistics isAuthenticated={true} />);

    expect(await screen.findByText('40%')).toBeInTheDocument();
    expect(screen.getByText('Trustroots Statistics')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Subscribe to newsletter' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nostroots 1%')).toBeInTheDocument();
    expect(screen.getByText('Experiences')).toBeInTheDocument();
    expect(screen.getByText('Recommended by members')).toBeInTheDocument();
    expect(
      screen.getByText('89% of answered recommendations'),
    ).toBeInTheDocument();
    expect(screen.getByText('Real-life connections')).toBeInTheDocument();
  });

  it('hides the newsletter subscribe link for unauthenticated visitors', async () => {
    get.mockResolvedValueOnce({
      data: {
        total: 1,
        hosting: { total: 0, percentage: 0, yesPercentage: 0 },
        connections: [],
        newsletter: { percentage: 0, count: 0 },
      },
    });

    render(<Statistics isAuthenticated={false} />);

    expect(await screen.findByText('Members')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Subscribe to newsletter' }),
    ).not.toBeInTheDocument();
  });

  it('renders network loading placeholders while statistics are pending', () => {
    get.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(<Statistics isAuthenticated={false} />);

    expect(container.querySelectorAll('li div')).toHaveLength(6);
  });

  it('falls back to zero values when optional statistics are missing', async () => {
    get.mockResolvedValueOnce({
      data: {
        total: 0,
        connections: [{ network: 'warmshowers', count: 0, percentage: 0 }],
      },
    });

    render(<Statistics isAuthenticated={true} />);

    expect(await screen.findByText('Warmshowers 0%')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.getByText('0% yes')).toBeInTheDocument();
    expect(screen.getByText('0 subscribers')).toBeInTheDocument();
  });
});

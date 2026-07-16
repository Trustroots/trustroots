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
        messageInteractions: {
          total: 40,
          positive: 7,
          negative: 3,
          recent: { total: 8, positive: 2, negative: 2 },
        },
      },
    });

    render(<Statistics isAuthenticated={true} />);

    expect(await screen.findByText('40%')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .slice(0, 2)
        .map(heading => heading.textContent),
    ).toEqual(['Real-life connections', 'Message interactions']);
    expect(screen.getByText('Trustroots Statistics')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Subscribe to newsletter' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nostroots 1%')).toBeInTheDocument();
    expect(screen.getByText('Real-life connections')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A lower bound: most people do not share an experience, and only experiences shared since 2016 are counted.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('89% recommended overall')).toBeInTheDocument();
    expect(
      screen.getByText('83% recommended in the last 90 days'),
    ).toBeInTheDocument();
    expect(screen.getByText('Message interactions')).toBeInTheDocument();
    expect(
      screen.getByText('Interactions where both members exchanged messages'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('70% positive feedback overall'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('50% positive feedback in the last 90 days'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Experiences')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Recommended by members'),
    ).not.toBeInTheDocument();
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
        messageInteractions: { negative: 1, recent: { negative: 1 } },
      },
    });

    render(<Statistics isAuthenticated={true} />);

    expect(await screen.findByText('Warmshowers 0%')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.getByText('0% yes')).toBeInTheDocument();
    expect(screen.getByText('0 subscribers')).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Statistics from '@/modules/statistics/client/components/Statistics.component';
import {
  get,
  getCharts,
  type StatisticsResponse,
} from '@/modules/statistics/client/api/statistics.api';
import { getSuggestion } from '@/modules/experiences/client/api/experiences.api';
import { AxiosHeaders, type AxiosResponse } from 'axios';
import type Board from '@/modules/core/client/components/Board';

const getMock = jest.mocked(get);
const getChartsMock = jest.mocked(getCharts);
const getSuggestionMock = jest.mocked(getSuggestion);

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

jest.mock('@/modules/statistics/client/api/statistics.api');
jest.mock('@/modules/experiences/client/api/experiences.api');

jest.mock('@/modules/core/client/components/Board', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockBoard({ children }: React.ComponentProps<typeof Board>) {
    return <div>{children}</div>;
  }
  return MockBoard;
});

beforeEach(() => {
  getSuggestionMock.mockResolvedValue(null);
  getChartsMock.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('<Statistics />', () => {
  it('renders statistics from the api', async () => {
    getSuggestionMock.mockResolvedValueOnce({
      _id: 'contact-1',
      displayName: 'Casey Contact',
      username: 'casey-contact',
    });
    getMock.mockResolvedValueOnce(
      response({
        total: 12345,
        recentActivity: {
          signups: { past24Hours: 6, past7Days: 42 },
          threads: { past24Hours: 8, past7Days: 56 },
          messages: { past24Hours: 120, past7Days: 840 },
        },
        hosting: {
          total: 1000,
          percentage: 40,
          yes: 500,
          yesPercentage: 20,
          maybe: 500,
          maybePercentage: 20,
        },
        connections: [
          { network: 'couchers', count: 25, percentage: 2.5 },
          { network: 'couchsurfing', count: 100, percentage: 10 },
          { network: 'facebook', count: 45, percentage: 4.5 },
          { network: 'github', count: 3, percentage: 0.3 },
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
      }),
    );

    render(<Statistics isAuthenticated={true} />);

    expect(await screen.findByText('40%')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .slice(0, 2)
        .map(heading => heading.textContent),
    ).toEqual(['Real-life connections', 'Message interactions']);
    expect(screen.getByText('Trustroots Statistics')).toBeInTheDocument();
    expect(screen.getByText('Loading charts…')).toBeInTheDocument();
    expect(screen.queryByAltText('Translation status')).not.toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(
      screen.getByText('42 new signups in the past 7 days (168 hours)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('6 new signups in the past 24 hours'),
    ).toBeInTheDocument();
    const activityTable = screen.getByRole('table', {
      name: 'Recent activity',
    });
    expect(activityTable).toHaveAccessibleName('Recent activity');
    expect(screen.getByText('Updated hourly')).toBeInTheDocument();
    expect(
      screen.getAllByRole('columnheader').map(header => header.textContent),
    ).toContain('Past 7 days (168 hours)');
    expect(
      screen.getAllByRole('columnheader').map(header => header.textContent),
    ).toContain('Past 24 hours');
    expect(
      within(activityTable).getByRole('rowheader', { name: 'New threads' }),
    ).toBeInTheDocument();
    expect(
      within(activityTable).getByRole('rowheader', { name: 'Messages sent' }),
    ).toBeInTheDocument();
    expect(within(activityTable).getByText('56')).toBeInTheDocument();
    expect(within(activityTable).getByText('8')).toBeInTheDocument();
    expect(within(activityTable).getByText('840')).toBeInTheDocument();
    expect(within(activityTable).getByText('120')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Subscribe to newsletter' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nostroots')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('4.5%')).toBeInTheDocument();
    expect(screen.getByText('0.3%')).toBeInTheDocument();
    expect(screen.getAllByText('Legacy')).toHaveLength(3);
    expect(screen.getByText('Couchsurfing').closest('li')).toHaveTextContent(
      'Legacy',
    );
    expect(screen.getByText('Couchers.org').closest('li')).toHaveTextContent(
      '2.5%',
    );
    expect(
      screen.getByText('Couchers.org').closest('li'),
    ).not.toHaveTextContent('Legacy');
    expect(
      screen.getByText(
        'Couchsurfing, Facebook and GitHub percentages represent legacy connections from previously linked accounts.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Real-life connections')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This is a lower bound: most people do not share an experience, and Trustroots did not have this experience feature until 2021.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Why not write some nice words about Casey Contact?',
      }),
    ).toHaveAttribute('href', '/profile/casey-contact/experiences/new');
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

  it('renders chart counts and keeps the volunteering link below the charts', async () => {
    getMock.mockResolvedValueOnce(response({ total: 10 }));
    getChartsMock.mockResolvedValueOnce(
      response({
        weeks: [
          {
            weekStarting: '2026-01-05',
            signups: 12,
            conversationsStarted: 8,
            firstReplies: 5,
          },
        ],
        memberActivity: {
          past7Days: 1,
          past14Days: 2,
          past30Days: 3,
          past6Months: 4,
          past12Months: 5,
        },
      }),
    );
    render(<Statistics isAuthenticated={false} />);

    const signups = await screen.findByRole('table', {
      name: 'Weekly signups',
    });
    const activity = screen.getByRole('table', { name: 'Member activity' });
    const conversations = screen.getByRole('table', {
      name: 'Conversations and first replies',
    });
    expect(within(signups).getByRole('cell', { name: '12' })).toBeVisible();
    expect(
      within(activity).getByRole('row', { name: 'Past 6 months 4' }),
    ).toBeVisible();
    expect(
      within(conversations)
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['8', '5']);
    const volunteer = screen.getByRole('link', {
      name: 'Consider volunteering!',
    });
    expect(volunteer).toHaveAttribute('href', '/support?category=volunteering');
    expect(
      conversations.compareDocumentPosition(volunteer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText(/stats galore/)).not.toBeInTheDocument();
  });

  it('reports a chart request failure independently of the statistics', async () => {
    getMock.mockResolvedValueOnce(response({ total: 10 }));
    getChartsMock.mockRejectedValueOnce(new Error('Unavailable'));
    render(<Statistics isAuthenticated={false} />);

    expect(await screen.findByText('Chart data is unavailable.')).toBeVisible();
    expect(
      screen.getByRole('table', { name: 'Recent activity' }),
    ).toBeVisible();
  });

  it('hides the newsletter subscribe link for unauthenticated visitors', async () => {
    getMock.mockResolvedValueOnce(
      response({
        total: 1,
        hosting: { total: 0, percentage: 0, yesPercentage: 0 },
        connections: [],
        newsletter: { percentage: 0, count: 0 },
      }),
    );

    render(<Statistics isAuthenticated={false} />);

    expect(await screen.findByText('Members')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Subscribe to newsletter' }),
    ).not.toBeInTheDocument();
    expect(getSuggestion).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Help make this picture more complete/),
    ).not.toBeInTheDocument();
  });

  it('shows a general encouragement when no suggestion is available', async () => {
    getMock.mockResolvedValueOnce(response({ total: 1, connections: [] }));

    render(<Statistics isAuthenticated={true} />);

    expect(
      await screen.findByText(
        "Help make this picture more complete by sharing an experience from a member's profile.",
      ),
    ).toBeInTheDocument();
  });

  it('shows the general encouragement when suggestion loading fails', async () => {
    getMock.mockResolvedValueOnce(response({ total: 1, connections: [] }));
    getSuggestionMock.mockRejectedValueOnce(new Error('unavailable'));

    render(<Statistics isAuthenticated={true} />);

    expect(
      await screen.findByText(
        "Help make this picture more complete by sharing an experience from a member's profile.",
      ),
    ).toBeInTheDocument();
  });

  it('renders network loading placeholders while statistics are pending', () => {
    getMock.mockReturnValueOnce(
      new Promise<AxiosResponse<StatisticsResponse>>(() => {}),
    );

    const { container } = render(<Statistics isAuthenticated={false} />);

    expect(container.querySelectorAll('li div')).toHaveLength(7);
    expect(
      screen.getByRole('table', { name: 'Recent activity' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('status', { name: 'Loading statistics' }),
    ).toHaveLength(4);
  });

  it('falls back to zero values when optional statistics are missing', async () => {
    getMock.mockResolvedValueOnce(
      response({
        total: 0,
        connections: [{ network: 'warmshowers', count: 0, percentage: 0 }],
        messageInteractions: { negative: 1, recent: { negative: 1 } },
      }),
    );

    render(<Statistics isAuthenticated={true} />);

    expect(await screen.findByText('Warmshowers')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.getByText('0% yes')).toBeInTheDocument();
    expect(screen.getByText('0 subscribers')).toBeInTheDocument();
    expect(
      screen.getByText('0 new signups in the past 7 days (168 hours)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('0 new signups in the past 24 hours'),
    ).toBeInTheDocument();
    const activityTable = screen.getByRole('table', {
      name: 'Recent activity',
    });
    expect(within(activityTable).getAllByText('0')).toHaveLength(4);
  });
});

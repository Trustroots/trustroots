import React from 'react';
import { render, screen, within } from '@testing-library/react';

import '@/config/client/i18n';
import HomeConnections from '@/modules/pages/client/components/HomeConnections.component';
import type { ConnectionsDiscovery } from '@/modules/tribes/client/api/tribes.api';

vi.mock('@/modules/tribes/client/components/CircleLocationMap', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({
      locations,
      legend,
      viewKey,
    }: {
      locations: { id: string; name: string; latitude: number }[];
      legend: React.ReactNode;
      viewKey: string;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'hosting-map', 'data-view-key': viewKey },
        legend,
        ...locations.map(location =>
          React.createElement('span', { key: location.id }, location.name),
        ),
      ),
  };
});

describe('<HomeConnections />', () => {
  it('keeps the section hidden when there are no connections', () => {
    const { container } = render(
      <HomeConnections connections={{ recent: [], hosts: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows recent members and maps every valid hosting or meeting connection', async () => {
    const connections: ConnectionsDiscovery = {
      recent: [
        {
          _id: 'recent-1',
          username: 'recent-member',
          displayName: 'Recent Member',
          activity: 'today',
        },
        {
          _id: 'recent-2',
          username: 'week-member',
          displayName: 'Weekly Member',
          activity: 'week',
        },
        {
          _id: 'recent-3',
          username: 'month-member',
          displayName: 'Monthly Member',
          activity: 'month',
        },
      ],
      hosts: [
        {
          _id: 'older-host',
          username: 'older-host',
          displayName: 'Older Host',
          location: [52.52, 13.405],
        },
        {
          _id: 'recent-host',
          username: 'recent-host',
          displayName: 'Recent Host',
          location: [-22.9068, -43.1729],
        },
        {
          _id: 'invalid-host',
          username: 'invalid-host',
          displayName: 'Invalid Host',
          location: [95, 0],
        },
      ],
      meetings: [
        {
          _id: 'meeting-member',
          username: 'meeting-member',
          displayName: 'Meeting Member',
          location: [1, 1],
        },
      ],
    };

    render(<HomeConnections connections={connections} />);

    expect(
      await screen.findByRole('heading', {
        name: 'People you know who were active recently',
      }),
    ).toBeInTheDocument();
    const recent = screen.getByRole('region', {
      name: 'People you know who were active recently',
    });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: /Recent Member/ }),
    ).toHaveTextContent('Active today');
    expect(
      screen.getByRole('link', { name: /Weekly Member/ }),
    ).toHaveTextContent('Active this week');
    expect(
      screen.getByRole('link', { name: /Monthly Member/ }),
    ).toHaveTextContent('Active this month');
    const map = await screen.findByTestId('hosting-map');
    expect(map).toHaveAttribute('data-view-key', 'home-hosting-map-view');
    expect(map).toHaveTextContent('Older Host');
    expect(map).toHaveTextContent('Recent Host');
    expect(map).not.toHaveTextContent('Invalid Host');
    expect(map).toHaveTextContent('Meeting Member');
    expect(within(map).getByText('Hosting')).toBeInTheDocument();
    expect(within(map).getByText('Happy to meet')).toBeInTheDocument();
  });

  it.each([
    ['hosts', 'Hosting'],
    ['meetings', 'Happy to meet'],
  ] as const)(
    'only shows a legend entry when there are %s',
    async (type, label) => {
      const connections: ConnectionsDiscovery = {
        recent: [],
        hosts: [],
        [type]: [
          {
            _id: 'member',
            username: 'member',
            displayName: 'Example Member',
            location: [1, 1],
          },
        ],
      };

      render(<HomeConnections connections={connections} />);
      const map = await screen.findByTestId('hosting-map');
      expect(within(map).getAllByRole('listitem')).toHaveLength(1);
      expect(within(map).getByRole('listitem')).toHaveTextContent(label);
    },
  );
});

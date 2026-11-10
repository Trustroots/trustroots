import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import HomeConnections from '@/modules/pages/client/components/HomeConnections.component';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');
jest.mock('@/modules/tribes/client/components/CircleLocationMap', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({
      locations,
      viewKey,
    }: {
      locations: { id: string; name: string; latitude: number }[];
      viewKey: string;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'hosting-map', 'data-view-key': viewKey },
        ...locations.map(location =>
          React.createElement('span', { key: location.id }, location.name),
        ),
      ),
  };
});

const getConnections = jest.mocked(tribesApi.getConnections);

describe('<HomeConnections />', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows recent members and maps every valid hosting connection', async () => {
    getConnections.mockResolvedValueOnce({
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
    });

    render(<HomeConnections />);

    expect(
      await screen.findByRole('heading', {
        name: 'People you know who were active recently',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Active today')).toBeInTheDocument();
    expect(screen.getByText('Active this week')).toBeInTheDocument();
    const map = screen.getByTestId('hosting-map');
    expect(map).toHaveAttribute('data-view-key', 'home-hosting-map-view');
    expect(map).toHaveTextContent('Older Host');
    expect(map).toHaveTextContent('Recent Host');
    expect(map).not.toHaveTextContent('Invalid Host');
  });
});

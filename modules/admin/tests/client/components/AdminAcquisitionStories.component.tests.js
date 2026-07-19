import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminAcquisitionStories from '@/modules/admin/client/components/AdminAcquisitionStories.component';
import * as acquisitionStoriesApi from '@/modules/admin/client/api/acquisition-stories.api';

jest.mock('@/modules/admin/client/api/acquisition-stories.api');
jest.mock('@/modules/core/client/components/LoadingIndicator', () => {
  const React = require('react');

  return function MockLoadingIndicator() {
    return <div role="alertdialog">Wait a moment</div>;
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('<AdminAcquisitionStories />', () => {
  it('loads and renders acquisition stories with member links', async () => {
    acquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        acquisitionStory: 'I met people at a hitchhiking festival.',
        circleCount: 3,
        created: '2026-04-05T06:07:08.000Z',
        displayName: 'Alice Example',
        username: 'alice',
      },
    ]);

    render(<AdminAcquisitionStories />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment');
    expect(
      await screen.findByText('I met people at a hitchhiking festival.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'alice (Alice Example)' }),
    ).toHaveAttribute('href', '/admin/user?id=111111111111111111111111');
    expect(
      screen.getByRole('link', {
        name: 'Open public profile for Alice Example',
      }),
    ).toHaveAttribute('href', '/profile/alice');
    const profileImage = screen
      .getByRole('link', {
        name: 'Open public profile for Alice Example',
      })
      .querySelector('img');
    expect(profileImage).toHaveAttribute('loading', 'lazy');
    expect(profileImage).toHaveAttribute(
      'src',
      '/api/users/111111111111111111111111/avatar?size=32',
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Stories' }).closest('li'),
    ).toHaveClass('active');
  });

  it('shows an empty state when no acquisition stories are returned', async () => {
    acquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce(null);

    render(<AdminAcquisitionStories />);

    expect(
      await screen.findByText('No acquisition stories found.'),
    ).toBeInTheDocument();
    expect(acquisitionStoriesApi.getAcquisitionStories).toHaveBeenCalledTimes(
      1,
    );
  });

  it('renders stories with missing or invalid dates', async () => {
    acquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        acquisitionStory: 'No date story.',
        username: 'alice',
      },
      {
        _id: '222222222222222222222222',
        acquisitionStory: 'Invalid date story.',
        created: 'not-a-date',
        username: 'bob',
      },
    ]);

    render(<AdminAcquisitionStories />);

    expect(await screen.findByText('No date story.')).toBeInTheDocument();
    expect(screen.getByText('Invalid date story.')).toBeInTheDocument();
    expect(screen.getAllByText('', { selector: 'time' })).toHaveLength(2);
  });

  it('sorts stories by every table column', async () => {
    acquisitionStoriesApi.getAcquisitionStories.mockResolvedValueOnce([
      {
        _id: '111111111111111111111111',
        acquisitionStory: 'Zebra recommendation',
        circleCount: 2,
        created: '2026-01-01T00:00:00.000Z',
        displayName: 'Alice Example',
        username: 'alice',
      },
      {
        _id: '222222222222222222222222',
        acquisitionStory: 'A friend recommended it',
        circleCount: 0,
        created: '2026-02-01T00:00:00.000Z',
        displayName: 'Bob Example',
        username: 'bob',
      },
    ]);

    render(<AdminAcquisitionStories />);
    await screen.findByText('Zebra recommendation');

    const storyOrder = () =>
      Array.from(document.querySelectorAll('tbody tr')).map(row =>
        row.textContent.includes('Zebra recommendation') ? 'alice' : 'bob',
      );

    expect(storyOrder()).toEqual(['bob', 'alice']);
    expect(screen.getByText('Date ▼').closest('th')).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Date ▼' }));
    expect(storyOrder()).toEqual(['alice', 'bob']);
    fireEvent.click(screen.getByRole('button', { name: 'Date ▲' }));
    expect(storyOrder()).toEqual(['bob', 'alice']);

    fireEvent.click(screen.getByRole('button', { name: 'Member' }));
    expect(storyOrder()).toEqual(['alice', 'bob']);

    fireEvent.click(screen.getByRole('button', { name: 'Circles' }));
    expect(storyOrder()).toEqual(['bob', 'alice']);
    fireEvent.click(screen.getByRole('button', { name: 'Circles ▲' }));
    expect(storyOrder()).toEqual(['alice', 'bob']);

    fireEvent.click(screen.getByRole('button', { name: 'Story' }));
    expect(storyOrder()).toEqual(['bob', 'alice']);
  });
});

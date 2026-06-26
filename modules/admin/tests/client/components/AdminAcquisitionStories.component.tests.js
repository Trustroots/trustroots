import React from 'react';
import { render, screen } from '@testing-library/react';
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
});

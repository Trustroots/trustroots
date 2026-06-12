import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminAcquisitionStoriesAnalysis from '@/modules/admin/client/components/AdminAcquisitionStoriesAnalysis.component';
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

const analysis = {
  df: 2,
  entropy: 1.23,
  size: 3,
  sum: 12,
  x2: 4.56,
  table: [
    {
      category: 'Search',
      observed: 5,
      percentage: '41.67%',
    },
    {
      category: 'Friend',
      observed: 2,
      percentage: '16.67%',
    },
  ],
};

describe('<AdminAcquisitionStoriesAnalysis />', () => {
  it('loads analysis and initially hides low-frequency terms', async () => {
    acquisitionStoriesApi.getAcquisitionStoriesAnalysis.mockResolvedValueOnce(
      analysis,
    );

    render(<AdminAcquisitionStoriesAnalysis />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment');
    expect(await screen.findByText('Degree of freedom: 2')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.queryByText('Friend')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Analysis' }).closest('li'),
    ).toHaveClass('active');
  });

  it('reveals all analysis terms on request', async () => {
    acquisitionStoriesApi.getAcquisitionStoriesAnalysis.mockResolvedValueOnce(
      analysis,
    );

    render(<AdminAcquisitionStoriesAnalysis />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Show all 2 terms' }),
    );

    expect(screen.getByText('Friend')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show all 2 terms' }),
    ).not.toBeInTheDocument();
  });
});

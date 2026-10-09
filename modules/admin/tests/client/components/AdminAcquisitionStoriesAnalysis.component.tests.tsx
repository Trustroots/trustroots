import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminAcquisitionStoriesAnalysis from '@/modules/admin/client/components/AdminAcquisitionStoriesAnalysis.component';
import * as acquisitionStoriesApi from '@/modules/admin/client/api/acquisition-stories.api';

jest.mock('@/modules/admin/client/api/acquisition-stories.api');
const mockedAcquisitionStoriesApi = jest.mocked(acquisitionStoriesApi);
jest.mock('@/modules/core/client/components/LoadingIndicator', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return function MockLoadingIndicator() {
    return <div role="alertdialog">Wait a moment</div>;
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

type AnalysisFixture = {
  df: number;
  entropy: number;
  size: number;
  sum: number;
  x2: number;
  table: Array<{ category: string; observed: number; percentage: number }>;
};

const analysis: AnalysisFixture = {
  df: 2,
  entropy: 1.23,
  size: 3,
  sum: 12,
  x2: 4.56,
  table: [
    {
      category: 'Search',
      observed: 5,
      percentage: 41.67,
    },
    {
      category: 'Friend',
      observed: 2,
      percentage: 16.67,
    },
  ],
};

describe('<AdminAcquisitionStoriesAnalysis />', () => {
  it('loads analysis and initially hides low-frequency terms', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStoriesAnalysis.mockResolvedValueOnce(
      analysis,
    );

    render(<AdminAcquisitionStoriesAnalysis />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wait a moment');
    expect(await screen.findByText('Degree of freedom: 2')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.queryByText('Friend')).not.toBeInTheDocument();
    expect(
      within(document.querySelector('.nav-tabs')!)
        .getByRole('link', { name: 'Analysis' })
        .closest('li'),
    ).toHaveClass('active');
  });

  it('reveals all analysis terms on request', async () => {
    mockedAcquisitionStoriesApi.getAcquisitionStoriesAnalysis.mockResolvedValueOnce(
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

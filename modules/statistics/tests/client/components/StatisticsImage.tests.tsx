import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import StatisticsImage from '@/modules/statistics/client/components/StatisticsImage';

describe('<StatisticsImage />', () => {
  it('loads external images without blocking the page load event', () => {
    render(
      <StatisticsImage
        alt="Member growth"
        src="https://charts.example/chart.png"
        width="100%"
      />,
    );

    const image = screen.getByRole('img', { name: 'Member growth' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('width', '100%');
    fireEvent.load(image);
    expect(image).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('replaces failed images with readable text while preserving the dashboard link', () => {
    render(
      <a href="https://charts.example/dashboard">
        <StatisticsImage
          alt="Member growth"
          src="https://charts.example/chart.png"
        />
      </a>,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Member growth' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Member growth: Image unavailable',
    );
    expect(
      screen.getByRole('link', { name: 'Member growth: Image unavailable' }),
    ).toHaveAttribute('href', 'https://charts.example/dashboard');
  });
});

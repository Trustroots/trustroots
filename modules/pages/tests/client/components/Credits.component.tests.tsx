import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Credits from '@/modules/pages/client/components/Credits.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  return function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  };
});

it('credits the data providers and contributors', () => {
  render(<Credits />);
  expect(
    screen.getByText(/This product includes GeoLite2 data/),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'MaxMind' })).toHaveAttribute(
    'href',
    'https://www.maxmind.com',
  );
  expect(
    screen.getByRole('link', { name: 'OpenStreetMap contributors' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Photography' }),
  ).toBeInTheDocument();
});

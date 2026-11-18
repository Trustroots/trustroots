import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import Credits from '@/modules/pages/client/components/Credits.component';

vi.mock('@/modules/core/client/components/Board.js', async () => {
  const actualReact = await vi.importActual<typeof import('react')>('react');
  return {
    default: function MockBoard({ children }: PropsWithChildren) {
      return actualReact.createElement('div', null, children);
    },
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

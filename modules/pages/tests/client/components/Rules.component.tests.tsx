import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Rules from '@/modules/pages/client/components/Rules.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');

  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }

  return MockBoard;
});

describe('<Rules />', () => {
  it('renders composed rules page with embedded RulesText', () => {
    render(<Rules />);

    expect(screen.getByRole('heading', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
    expect(
      screen.getByText(/Be friendly and know when to stop messaging someone\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'safety' })).toHaveAttribute(
      'href',
      '/safety',
    );
    expect(screen.getByRole('link', { name: 'privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});

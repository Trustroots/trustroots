import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Contribute from '@/modules/pages/client/components/Contribute.component';
import type PageBoard from '@/modules/pages/client/components/PageBoard';

type BoardProps = React.ComponentProps<typeof PageBoard>;

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockBoard({ children }: BoardProps) {
    return <div>{children}</div>;
  }

  return MockBoard;
});

describe('<Contribute />', () => {
  it('renders the funding headline and trustroots foundation link', () => {
    render(<Contribute />);

    expect(
      screen.getByRole('heading', { name: 'Support Trustroots' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'foundation' })).toHaveAttribute(
      'href',
      '/foundation',
    );
  });
});

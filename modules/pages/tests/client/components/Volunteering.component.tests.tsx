import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Volunteering from '@/modules/pages/client/components/Volunteering.component';
import { VOLUNTEERING_DISCLAIMER } from '@/modules/support/shared/volunteering-copy';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');
  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }

  return MockBoard;
});

describe('<Volunteering />', () => {
  it('renders invitation copy and team guide link', () => {
    render(<Volunteering />);

    expect(
      screen.getByRole('heading', { name: 'Volunteering' }),
    ).toBeInTheDocument();
    expect(screen.getByText(VOLUNTEERING_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Guide' })).toHaveAttribute(
      'href',
      'https://team.trustroots.org/',
    );
    expect(
      screen.getByRole('link', { name: 'I’d like to help run Trustroots' }),
    ).toHaveAttribute('href', '/support?category=volunteering');
  });
});

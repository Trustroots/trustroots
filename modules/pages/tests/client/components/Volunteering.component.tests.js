import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Volunteering from '@/modules/pages/client/components/Volunteering.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = require('react');

  function MockBoard({ children }) {
    return <div>{children}</div>;
  }

  MockBoard.propTypes = {
    children: () => null,
  };

  return MockBoard;
});

describe('<Volunteering />', () => {
  it('renders invitation copy and team guide link', () => {
    render(<Volunteering />);

    expect(
      screen.getByRole('heading', { name: 'Volunteering' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Guide' })).toHaveAttribute(
      'href',
      'https://team.trustroots.org/',
    );
  });
});

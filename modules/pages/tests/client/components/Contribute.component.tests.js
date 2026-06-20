import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Contribute from '@/modules/pages/client/components/Contribute.component';

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

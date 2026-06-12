import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Rules from '@/modules/pages/client/components/Rules.component';

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

describe('<Rules />', () => {
  it('renders composed rules page with embedded RulesText', () => {
    render(<Rules />);

    expect(screen.getByRole('heading', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
    expect(
      screen.getByText(/Be friendly and know when to stop messaging someone\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'privacy' })).toHaveAttribute(
      'href',
      'privacy',
    );
  });
});

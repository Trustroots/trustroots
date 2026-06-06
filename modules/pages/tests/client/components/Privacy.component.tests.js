import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Privacy from '@/modules/pages/client/components/Privacy.component';

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

describe('<Privacy />', () => {
  it('renders privacy policy headings and key links', () => {
    render(<Privacy />);

    expect(
      screen.getByRole('heading', { name: 'Privacy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Trustroots Privacy Policy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SparkPost' })).toHaveAttribute(
      'href',
      'https://www.sparkpost.com/',
    );
  });
});

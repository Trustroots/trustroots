import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Guide from '@/modules/pages/client/components/Guide.component';

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

describe('<Guide />', () => {
  it('renders key guidance sections and editor actions', () => {
    render(<Guide />);

    expect(
      screen.getByRole('heading', { name: 'Trustroots Guide' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Make sure your profile is complete',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Fill your profile' }),
    ).toHaveAttribute('href', '/profile/edit');
    expect(screen.getByRole('link', { name: 'Find members' })).toHaveAttribute(
      'href',
      '/search',
    );
  });
});

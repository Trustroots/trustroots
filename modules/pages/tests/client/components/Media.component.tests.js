import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Media from '@/modules/pages/client/components/Media.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = require('react');
  function MockBoard({ children }) {
    return <div>{children}</div>;
  }
  MockBoard.propTypes = { children: () => null };
  return MockBoard;
});

describe('<Media />', () => {
  it('renders the media page headings and links', () => {
    render(<Media />);

    expect(screen.getByText('Trustroots in Media')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Fact sheet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PNG' })).toHaveAttribute(
      'href',
      'https://raw.githubusercontent.com/Trustroots/media/master/logo/logo.png',
    );
  });
});

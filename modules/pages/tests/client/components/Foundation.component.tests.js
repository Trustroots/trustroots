import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Foundation from '@/modules/pages/client/components/Foundation.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = require('react');
  function MockBoard({ children }) {
    return <div>{children}</div>;
  }
  MockBoard.propTypes = { children: () => null };
  return MockBoard;
});

describe('<Foundation />', () => {
  it('renders foundation headings and board members', () => {
    render(
      <Foundation
        user={{
          _id: 'me',
          username: 'me',
          displayName: 'Current User',
        }}
      />,
    );

    expect(screen.getByText('Trustroots Foundation')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
    expect(screen.getByText('Mikael')).toBeInTheDocument();
    expect(screen.getByText('Past board members')).toBeInTheDocument();
  });

  it('renders core mission copy and trustees details', () => {
    render(
      <Foundation user={{ _id: 'me', username: 'me', displayName: 'Me' }} />,
    );

    expect(screen.getByText('Vision, Mission & Values')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Trustroots is owned and operated by Trustroots Foundation/,
      ),
    ).toBeInTheDocument();
  });

  it('shows a join button for logged-out visitors', () => {
    render(<Foundation user={null} />);

    expect(
      screen.getByRole('link', { name: 'Join Trustroots' }),
    ).toHaveAttribute('href', '/signup');
  });
});

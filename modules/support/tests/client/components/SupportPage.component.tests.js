import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SupportPage from '@/modules/support/client/components/SupportPage.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = require('react');
  const PropTypes = require('prop-types');
  function MockBoard({ children, names }) {
    return <div data-board={names}>{children}</div>;
  }
  MockBoard.propTypes = {
    children: PropTypes.node.isRequired,
    names: PropTypes.string.isRequired,
  };
  return MockBoard;
});

jest.mock('@/modules/support/client/components/SupportForm', () => {
  const React = require('react');
  const PropTypes = require('prop-types');
  function MockSupportForm({ user }) {
    return <div>{user ? `support:${user.username}` : 'support:anonymous'}</div>;
  }
  MockSupportForm.propTypes = { user: PropTypes.object };
  return MockSupportForm;
});

describe('<SupportPage />', () => {
  it('renders support content for signed-out visitors', () => {
    render(<SupportPage />);

    expect(screen.getByText('Trustroots Support')).toBeInTheDocument();
    expect(screen.getByText('support:anonymous')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Removing your account' }),
    ).not.toBeInTheDocument();
  });

  it('includes account-removal help for signed-in members', () => {
    render(<SupportPage user={{ username: 'alice' }} />);

    expect(screen.getByText('support:alice')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Removing your account' }),
    ).toHaveAttribute('href', '/profile/edit/account#remove');
  });
});

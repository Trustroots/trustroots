import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import SupportPage from '@/modules/support/client/components/SupportPage.component';
import type Board from '@/modules/core/client/components/Board';
import type SupportForm from '@/modules/support/client/components/SupportForm';

type BoardProps = React.ComponentProps<typeof Board>;
type SupportFormProps = React.ComponentProps<typeof SupportForm>;

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockBoard({ children, names }: BoardProps) {
    return <div data-board={names}>{children}</div>;
  }
  return MockBoard;
});

jest.mock('@/modules/support/client/components/SupportForm', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockSupportForm({ user }: SupportFormProps) {
    return <div>{user ? `support:${user.username}` : 'support:anonymous'}</div>;
  }
  return MockSupportForm;
});

describe('<SupportPage />', () => {
  it('renders support content for signed-out visitors', () => {
    render(<SupportPage />);

    expect(screen.getByText('Trustroots Support')).toBeInTheDocument();
    expect(screen.getByText('support:anonymous')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
      'href',
      '/support?category=reportBug',
    );
    expect(
      screen.getByRole('link', { name: 'Become a volunteer' }),
    ).toHaveAttribute('href', '/support?category=volunteering');
    expect(
      screen.queryByRole('link', { name: 'Removing your account' }),
    ).not.toBeInTheDocument();
  });

  it('includes account-removal help for signed-in members', () => {
    const user: React.ComponentProps<typeof SupportPage>['user'] = {
      username: 'sample-member',
    };
    render(<SupportPage user={user} />);

    expect(screen.getByText('support:sample-member')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Removing your account' }),
    ).toHaveAttribute('href', '/profile/edit/account#remove');
  });
});

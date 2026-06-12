import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import UserState from '@/modules/admin/client/components/UserState.component';

describe('<UserState />', () => {
  it('renders support-relevant profile state labels', () => {
    render(
      <UserState
        user={{
          email: 'alice@example.org',
          emailTemporary: 'pending@example.org',
          public: false,
          removeProfileExpires: '2026-01-02',
          removeProfileToken: 'remove-token',
          resetPasswordExpires: '2026-02-03',
          resetPasswordToken: 'password-token',
          roles: ['user', 'suspended', 'volunteer'],
        }}
      />,
    );

    expect(screen.queryByText('user')).not.toBeInTheDocument();
    expect(screen.getByText('suspended')).toHaveClass('label-danger');
    expect(screen.getByText('volunteer')).toHaveClass('label-success');
    expect(screen.getByText('Hidden profile')).toBeInTheDocument();
    expect(screen.getByText('Unconfirmed email change')).toBeInTheDocument();
    expect(screen.getByText('Pending removal')).toHaveAttribute(
      'title',
      'Link expiration 2026-01-02',
    );
    expect(screen.getByText('Pending password change')).toHaveAttribute(
      'title',
      'Link expiration 2026-02-03',
    );
  });

  it('distinguishes unconfirmed signups from email changes', () => {
    render(
      <UserState
        user={{
          email: 'alice@example.org',
          emailTemporary: 'alice@example.org',
          public: true,
          roles: [],
        }}
      />,
    );

    expect(screen.getByText('Unconfirmed signup')).toBeInTheDocument();
    expect(screen.queryByText('Hidden profile')).not.toBeInTheDocument();
  });
});

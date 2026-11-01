import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import UserState from '@/modules/admin/client/components/UserState.component';

describe('<UserState />', () => {
  it('displays the Greeters label', () => {
    render(<UserState user={{ roles: ['welcome-team'], public: true }} />);
    expect(screen.getByText('Greeter')).toBeInTheDocument();
  });

  it('shows team roles as neutral badges', () => {
    render(
      <UserState
        user={{ roles: ['moderator', 'support-team'], public: true }}
      />,
    );
    expect(screen.getByText('moderator')).toHaveAttribute(
      'data-tone',
      'neutral',
    );
    expect(screen.getByText('Support team')).toHaveAttribute(
      'data-tone',
      'neutral',
    );
  });

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
    expect(screen.getByText('suspended')).toHaveAttribute(
      'data-tone',
      'danger',
    );
    expect(screen.getByText('volunteer')).toHaveAttribute(
      'data-tone',
      'success',
    );
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

  it('can omit duplicate role badges while retaining account status', () => {
    render(
      <UserState
        showRoles={false}
        user={{
          roles: ['admin', 'volunteer'],
          public: false,
          email: 'river@example.org',
          emailTemporary: 'river@example.org',
        }}
      />,
    );
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    expect(screen.queryByText('volunteer')).not.toBeInTheDocument();
    expect(screen.getByText('Hidden profile')).toBeInTheDocument();
    expect(screen.getByText('Unconfirmed signup')).toBeInTheDocument();
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

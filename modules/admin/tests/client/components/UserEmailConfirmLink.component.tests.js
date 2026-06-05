import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import UserEmailConfirmLink from '@/modules/admin/client/components/UserEmailConfirmLink.component';

describe('<UserEmailConfirmLink />', () => {
  it('does not render without a pending email token and temporary email', () => {
    const { container } = render(
      <UserEmailConfirmLink
        user={{
          email: 'alice@example.org',
          emailTemporary: 'alice-new@example.org',
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('builds a signup confirmation link when the emails match', () => {
    render(
      <UserEmailConfirmLink
        user={{
          email: 'alice@example.org',
          emailTemporary: 'alice@example.org',
          emailToken: 'signup-token',
        }}
      />,
    );

    expect(
      screen.getByLabelText(
        'Link to confirm email alice@example.org during signup',
      ),
    ).toHaveValue(
      'https://www.trustroots.org/confirm-email/signup-token?signup=true',
    );
    expect(screen.getByText('alice@example.org')).toBeInTheDocument();
  });

  it('builds an email-change confirmation link when the emails differ', () => {
    render(
      <UserEmailConfirmLink
        user={{
          email: 'alice@example.org',
          emailTemporary: 'alice-new@example.org',
          emailToken: 'change-token',
        }}
      />,
    );

    expect(screen.getByLabelText(/Link to confirm email change/)).toHaveValue(
      'https://www.trustroots.org/confirm-email/change-token',
    );
    expect(screen.getByText('alice-new@example.org')).toBeInTheDocument();
  });
});

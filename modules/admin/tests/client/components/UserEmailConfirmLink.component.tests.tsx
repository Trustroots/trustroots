import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import UserEmailConfirmLink from '@/modules/admin/client/components/UserEmailConfirmLink.component';

type User = React.ComponentProps<typeof UserEmailConfirmLink>['user'];

describe('<UserEmailConfirmLink />', () => {
  it('does not render without a pending email token and temporary email', () => {
    const { container } = render(
      <UserEmailConfirmLink
        user={{
          email: 'member@example.test',
          emailTemporary: 'member-new@example.test',
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('builds a signup confirmation link when the emails match', () => {
    const user: User = {
      email: 'member@example.test',
      emailTemporary: 'member@example.test',
      emailToken: 'signup-token',
    };
    render(<UserEmailConfirmLink user={user} />);

    expect(
      screen.getByLabelText(
        'Link to confirm email member@example.test during signup',
      ),
    ).toHaveValue(
      'https://www.trustroots.org/confirm-email/signup-token?signup=true',
    );
    expect(screen.getByText('member@example.test')).toBeInTheDocument();
  });

  it('builds an email-change confirmation link when the emails differ', () => {
    const user: User = {
      email: 'member@example.test',
      emailTemporary: 'member-new@example.test',
      emailToken: 'change-token',
    };
    render(<UserEmailConfirmLink user={user} />);

    expect(screen.getByLabelText(/Link to confirm email change/)).toHaveValue(
      'https://www.trustroots.org/confirm-email/change-token',
    );
    expect(screen.getByText('member-new@example.test')).toBeInTheDocument();
  });
});

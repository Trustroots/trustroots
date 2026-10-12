import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import UserLink from '@/modules/users/client/components/UserLink';

type UserLinkProps = React.ComponentProps<typeof UserLink>;

describe('<UserLink />', () => {
  it('links to a member profile using their display name', () => {
    render(
      <UserLink user={{ displayName: 'Alice Example', username: 'alice' }} />,
    );

    expect(screen.getByRole('link', { name: 'Alice Example' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
  });

  it('uses the username as link text when no display name is available', () => {
    const user: UserLinkProps['user'] = { username: 'alice' };
    render(<UserLink user={user} />);

    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute(
      'href',
      '/profile/alice',
    );
  });

  it('falls back to an anonymous label when no username is available', () => {
    const anonymousUser: UserLinkProps['user'] = { username: '' };
    render(<UserLink className="text-muted" user={anonymousUser} />);

    expect(screen.getByText('Anonymous member')).toHaveClass('text-muted');
  });
});

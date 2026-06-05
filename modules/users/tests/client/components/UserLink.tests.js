import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import UserLink from '@/modules/users/client/components/UserLink';

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

  it('falls back to an anonymous label when no username is available', () => {
    render(<UserLink className="text-muted" user={{}} />);

    expect(screen.getByText('Anonymous member')).toHaveClass('text-muted');
  });
});

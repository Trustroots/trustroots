import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import UserLink from '@/modules/admin/client/components/UserLink.component';

beforeEach(() => {
  window.user = { roles: ['admin'] };
});
afterEach(() => {
  delete window.user;
});

describe('<UserLink />', () => {
  it.each([
    { roles: ['support-team'] },
    { roles: ['support-team', 'admin'] },
    { roles: [] },
    { roles: undefined },
  ])('uses the permitted account view for %j', ({ roles }) => {
    window.user = { roles };
    render(<UserLink user={{ _id: 'member-id', username: 'river' }} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      roles?.includes('support-team') && !roles.includes('admin')
        ? '/admin/support/member/member-id'
        : '/admin/user/river',
    );
  });
  it('uses public profile links or plain text when requested', () => {
    const { rerender } = render(
      <UserLink publicProfile user={{ _id: 'member-id', username: 'river' }} />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/profile/river');
    rerender(
      <UserLink
        publicProfile
        user={{ _id: 'member-id', displayName: 'River' }}
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('River')).toBeInTheDocument();
  });

  it('renders unknown when the user id is missing', () => {
    render(<UserLink user={{ username: 'missing-id' }} />);

    expect(screen.getByText('Unknown').tagName).toBe('EM');
  });

  it('prefers username, includes display name, and avoids id link text', () => {
    const { rerender } = render(
      <UserLink
        user={{
          _id: 'user-id-1',
          displayName: 'Alice Example',
          username: 'alice',
        }}
      />,
    );

    expect(screen.getByText('alice (Alice Example)')).toHaveAttribute(
      'href',
      '/admin/user/alice',
    );

    rerender(<UserLink user={{ _id: 'user-id-2', username: 'bob' }} />);
    expect(screen.getByText('bob')).toHaveAttribute('href', '/admin/user/bob');

    rerender(<UserLink user={{ _id: 'user-id-3' }} />);
    expect(screen.getByText('Unknown member')).toHaveAttribute(
      'href',
      '/admin/user?id=user-id-3',
    );
  });
});

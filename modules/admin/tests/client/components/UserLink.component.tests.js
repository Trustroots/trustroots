import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import UserLink from '@/modules/admin/client/components/UserLink.component';

describe('<UserLink />', () => {
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
      '/admin/user?id=user-id-1',
    );

    rerender(<UserLink user={{ _id: 'user-id-2', username: 'bob' }} />);
    expect(screen.getByText('bob')).toHaveAttribute(
      'href',
      '/admin/user?id=user-id-2',
    );

    rerender(<UserLink user={{ _id: 'user-id-3' }} />);
    expect(screen.getByText('Unknown member')).toHaveAttribute(
      'href',
      '/admin/user?id=user-id-3',
    );
  });
});

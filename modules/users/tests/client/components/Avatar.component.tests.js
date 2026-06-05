import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Avatar from '@/modules/users/client/components/Avatar.component';

const user = {
  _id: 'user-1',
  username: 'alice',
  displayName: 'Alice',
  avatarSource: 'none',
  avatarUploaded: true,
  updated: '2026-01-02T03:04:05.000Z',
  emailHash: 'abc123',
  additionalProvidersData: {
    facebook: { id: 'fb-123' },
  },
};

describe('<Avatar />', () => {
  it('links to the user profile by default', () => {
    render(<Avatar user={user} />);

    expect(
      screen.getByRole('link', { name: 'Open user profile for Alice' }),
    ).toHaveAttribute('href', '/profile/alice');
    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      '/img/avatar.png?none',
    );
  });

  it('uses the next generated local avatar size with a cache buster', () => {
    render(<Avatar user={user} source="local" size={36} link={false} />);

    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      '/uploads-profile/user-1/avatar/64.jpg?1767323045000',
    );
  });

  it('uses gravatar with an encoded fallback image', () => {
    render(<Avatar user={user} source="gravatar" size={128} link={false} />);

    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      'https://gravatar.com/avatar/abc123?s=128&d=https%3A%2F%2Ftrustroots.org%2Fimg%2Favatar.png',
    );
  });

  it('uses facebook when the provider id is available', () => {
    render(<Avatar user={user} source="facebook" size={64} link={false} />);

    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      'https://graph.facebook.com/fb-123/picture/?width=64&height=64',
    );
  });

  it('omits the profile link and forwards click handlers', () => {
    const onClick = jest.fn();

    const { container } = render(
      <Avatar user={user} link={false} onClick={onClick} />,
    );

    expect(container.querySelector('a')).not.toBeInTheDocument();
    fireEvent.click(container.firstChild);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

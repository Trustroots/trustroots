import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberAvatar from '@/modules/users/client/components/MemberAvatar';

const member = {
  _id: 'member-1',
  username: 'forest-member',
  displayName: 'Forest Member',
};

describe('MemberAvatar', () => {
  it('shows initials and a usable profile link when a member has no photo', () => {
    render(<MemberAvatar user={member} link />);
    expect(screen.getByText('FM')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open user profile for Forest Member' }),
    ).toHaveAttribute('href', '/profile/forest-member');
  });

  it.each([
    { avatarSource: 'local', avatarUploaded: false },
    { avatarSource: 'facebook' },
    { avatarSource: 'gravatar' },
    { avatarSource: 'none' },
  ])(
    'uses initials when the selected provider has no usable image: %j',
    data => {
      render(<MemberAvatar user={{ ...member, ...data }} />);
      expect(screen.getByText('FM')).toBeInTheDocument();
    },
  );

  it.each([
    { avatarSource: 'local', avatarUploaded: true },
    {
      avatarSource: 'facebook',
      additionalProvidersData: { facebook: { id: 'fictional-provider-id' } },
    },
    { avatarSource: 'gravatar', emailHash: 'fictional-hash' },
  ])('preserves real images and falls back after a loading error: %j', data => {
    const { container } = render(
      <MemberAvatar user={{ ...member, ...data }} />,
    );
    expect(container.querySelector('img')).toBeInTheDocument();
    fireEvent.error(container.querySelector('img'));
    expect(screen.getByText('FM')).toBeInTheDocument();
  });

  it('retries an updated image and uses the username if a name is unavailable', () => {
    const user = {
      ...member,
      displayName: '',
      avatarSource: 'local',
      avatarUploaded: true,
      avatarVersion: 'version-one',
    };
    const { container, rerender } = render(<MemberAvatar user={user} />);
    fireEvent.error(container.querySelector('img'));
    expect(screen.getByText('FO')).toBeInTheDocument();
    rerender(<MemberAvatar user={{ ...user, avatarVersion: 'version-two' }} />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('provides a neutral placeholder when all public identifiers are missing', () => {
    render(<MemberAvatar user={{}} link />);
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

it.each([{ _id: 'member-only-id' }, { displayName: 'Birch' }])(
  'shows placeholders for partial public profiles %j',
  user => {
    const { container } = render(<MemberAvatar user={user} />);
    expect(
      container.querySelector('.member-avatar-fallback'),
    ).toBeInTheDocument();
  },
);

it('labels an unnamed member profile link using their username', () => {
  render(
    <MemberAvatar
      user={{ _id: 'member-username', username: 'birch-member' }}
      link
    />,
  );
  expect(
    screen.getByRole('link', { name: 'Open user profile for birch-member' }),
  ).toHaveAttribute('href', '/profile/birch-member');
});

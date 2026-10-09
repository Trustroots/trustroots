import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberAvatar from '@/modules/users/client/components/MemberAvatar';

type MemberAvatarUser = React.ComponentProps<typeof MemberAvatar>['user'];

const member: MemberAvatarUser = {
  _id: 'member-1',
  username: 'forest-member',
  displayName: 'Forest Member',
};

function renderPartialMemberAvatar(
  user: Partial<MemberAvatarUser>,
  link = false,
) {
  // These cases deliberately exercise incomplete profiles from API responses.
  return render(<MemberAvatar user={user as MemberAvatarUser} link={link} />);
}

function getImage(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector('img');
  if (!image) throw new Error('Expected a profile image');
  return image;
}

const providersWithoutImages: Partial<MemberAvatarUser>[] = [
  { avatarSource: 'local', avatarUploaded: false },
  { avatarSource: 'facebook' },
  { avatarSource: 'gravatar' },
  { avatarSource: 'none' },
];

const providersWithImages: Partial<MemberAvatarUser>[] = [
  { avatarSource: 'local', avatarUploaded: true },
  {
    avatarSource: 'facebook',
    additionalProvidersData: { facebook: { id: 'fictional-provider-id' } },
  },
  { avatarSource: 'gravatar', emailHash: 'fictional-hash' },
];

describe('MemberAvatar', () => {
  it('shows initials and a usable profile link when a member has no photo', () => {
    render(<MemberAvatar user={member} link />);
    expect(screen.getByText('FM')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open user profile for Forest Member' }),
    ).toHaveAttribute('href', '/profile/forest-member');
  });

  it.each(providersWithoutImages)(
    'uses initials when the selected provider has no usable image: %j',
    data => {
      render(<MemberAvatar user={{ ...member, ...data }} />);
      expect(screen.getByText('FM')).toBeInTheDocument();
    },
  );

  it.each(providersWithImages)(
    'preserves real images and falls back after a loading error: %j',
    data => {
      const { container } = render(
        <MemberAvatar user={{ ...member, ...data }} />,
      );
      const image = getImage(container);
      expect(image).toBeInTheDocument();
      fireEvent.error(image);
      expect(screen.getByText('FM')).toBeInTheDocument();
    },
  );

  it('retries an updated image and uses the username if a name is unavailable', () => {
    const user = {
      ...member,
      displayName: '',
      avatarSource: 'local',
      avatarUploaded: true,
      avatarVersion: 'version-one',
    };
    const { container, rerender } = render(<MemberAvatar user={user} />);
    fireEvent.error(getImage(container));
    expect(screen.getByText('FO')).toBeInTheDocument();
    rerender(<MemberAvatar user={{ ...user, avatarVersion: 'version-two' }} />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('provides a neutral placeholder when all public identifiers are missing', () => {
    renderPartialMemberAvatar({}, true);
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

it.each([{ _id: 'member-only-id' }, { displayName: 'Birch' }])(
  'shows placeholders for partial public profiles %j',
  user => {
    const { container } = renderPartialMemberAvatar(user);
    expect(
      container.querySelector('.member-avatar-fallback'),
    ).toBeInTheDocument();
  },
);

it('labels an unnamed member profile link using their username', () => {
  renderPartialMemberAvatar(
    { _id: 'member-username', username: 'birch-member' },
    true,
  );
  expect(
    screen.getByRole('link', { name: 'Open user profile for birch-member' }),
  ).toHaveAttribute('href', '/profile/birch-member');
});

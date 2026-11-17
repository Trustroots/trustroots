import React from 'react';
import { render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import ProfileTribesTab from '@/modules/users/client/components/ProfileTribesTab.component';
import type JoinButton from '@/modules/tribes/client/components/JoinButton';
import type {
  TribeMembership,
  UserProfile,
} from '@/modules/users/client/types';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';

vi.mock('@/modules/tribes/client/components/JoinButton', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockJoinButton({
    tribe,
  }: Pick<React.ComponentProps<typeof JoinButton>, 'tribe'>) {
    return <button type="button">Join {tribe.label}</button>;
  }

  return { default: MockJoinButton };
});

const user: UserProfile = {
  _id: 'user-1',
  username: 'member-one',
  displayName: 'Member One',
};

const memberships: (TribeMembership & { tribe: TribeSummary })[] = [
  {
    tribe: {
      _id: 'tribe-1',
      slug: 'cyclists',
      label: 'Cyclists',
      count: 42,
      color: '2f6f4e',
    },
  },
  {
    tribe: {
      _id: 'tribe-2',
      slug: 'hikers',
      label: 'Hikers',
      count: 0,
    },
  },
];

describe('ProfileTribesTab', () => {
  it('shows a saved join reason to a signed-in viewer', () => {
    const withReason = [
      { ...memberships[0], joinReason: 'I want to meet other cyclists.' },
    ];
    const { rerender } = render(
      <ProfileTribesTab memberships={withReason} user={user} />,
    );
    expect(screen.getByText('I want to meet other cyclists.')).toBeVisible();
    rerender(<ProfileTribesTab memberships={withReason} />);
    expect(
      screen.queryByText('I want to meet other cyclists.'),
    ).not.toBeInTheDocument();
  });

  it('renders tribe cards with member counts and join buttons', () => {
    render(
      <ProfileTribesTab
        memberships={memberships}
        onMembershipUpdated={vi.fn()}
        user={user}
      />,
    );

    expect(screen.getByRole('link', { name: /Cyclists/ })).toHaveAttribute(
      'href',
      '/circles/cyclists',
    );
    expect(screen.getByText('42 members')).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Cyclists' })).toBeVisible();
    expect(document.querySelector('.tribe')).toHaveStyle({
      backgroundColor: '#2f6f4e',
    });
  });

  it('renders no cards when membership data is empty', () => {
    const { container } = render(
      <ProfileTribesTab onMembershipUpdated={vi.fn()} user={user} />,
    );

    expect(container.querySelectorAll('.tribe')).toHaveLength(0);
  });

  it('marks circles with custom images', () => {
    render(
      <ProfileTribesTab
        memberships={[
          {
            tribe: {
              ...memberships[0].tribe,
              image: '/circle.jpg',
            },
          },
        ]}
        onMembershipUpdated={vi.fn()}
        user={user}
      />,
    );

    expect(document.querySelector('.tribe-content')).toHaveClass('is-image');
  });
});

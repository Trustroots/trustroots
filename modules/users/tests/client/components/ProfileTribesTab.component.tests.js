import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ProfileTribesTab from '@/modules/users/client/components/ProfileTribesTab.component';

jest.mock('@/modules/tribes/client/components/JoinButton', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockJoinButton({ tribe }) {
    return <button type="button">Join {tribe.label}</button>;
  }

  MockJoinButton.propTypes = {
    tribe: PropTypes.object.isRequired,
  };

  return MockJoinButton;
});

const user = { _id: 'user-1', username: 'ada' };

const memberships = [
  {
    tribe: {
      _id: 'tribe-1',
      slug: 'cyclists',
      label: 'Cyclists',
      count: 42,
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
  it('renders tribe cards with member counts and join buttons', () => {
    render(
      <ProfileTribesTab
        memberships={memberships}
        onMembershipUpdated={jest.fn()}
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
  });

  it('renders no cards when membership data is empty', () => {
    const { container } = render(
      <ProfileTribesTab onMembershipUpdated={jest.fn()} user={user} />,
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
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );

    expect(document.querySelector('.tribe-content')).toHaveClass('is-image');
  });
});

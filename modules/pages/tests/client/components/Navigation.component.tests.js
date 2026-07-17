import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Navigation from '@/modules/pages/client/components/Navigation.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => key,
  }),
}));

jest.mock('@/modules/users/client/components/Avatar.component.js', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function MockAvatar({ user }) {
    return <div data-testid="avatar">{user.username}</div>;
  }

  MockAvatar.propTypes = {
    user: PropTypes.object,
  };

  return MockAvatar;
});

describe('<Navigation />', () => {
  const user = {
    username: 'alice',
    displayName: 'Alice Example',
  };

  it('renders profile and navigation links for a signed-in user', () => {
    render(<Navigation user={user} onSignout={jest.fn()} />);

    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute(
      'href',
      '/profile/edit',
    );
    expect(screen.getByRole('link', { name: 'Host' })).toHaveAttribute(
      'href',
      '/offer/host',
    );
    expect(screen.getByText('Alice Example').closest('a')).toHaveAttribute(
      'href',
      '/profile/alice',
    );
    expect(screen.getByTestId('avatar')).toHaveTextContent('alice');
    const wikiLink = screen.getByRole('link', { name: 'Wiki' });
    expect(wikiLink).toHaveAttribute('href', 'https://wiki.trustroots.org/');
    expect(wikiLink).toHaveAttribute('target', '_blank');
    expect(wikiLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Statistics' })).toHaveAttribute(
      'href',
      '/statistics',
    );
  });

  it('invokes onSignout when sign out link is clicked', () => {
    const onSignout = jest.fn();
    render(<Navigation user={user} onSignout={onSignout} />);

    fireEvent.click(screen.getByRole('link', { name: 'Sign out' }));

    expect(onSignout).toHaveBeenCalledTimes(1);
  });
});

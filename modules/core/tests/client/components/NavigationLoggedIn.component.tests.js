import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import NavigationLoggedIn from '@/modules/core/client/components/NavigationLoggedIn';

jest.mock('@/modules/users/client/components/Avatar.component.js', () => {
  const React = require('react');

  function MockAvatar() {
    return <span>avatar</span>;
  }

  return MockAvatar;
});

describe('<NavigationLoggedIn />', () => {
  const user = {
    _id: 'user-1',
    username: 'alice',
    displayName: 'Alice Example',
  };

  it('renders primary links and menu items for signed-in users', () => {
    render(
      <NavigationLoggedIn
        currentPath="/search"
        onSignout={jest.fn()}
        user={user}
      />,
    );

    expect(screen.getByRole('link', { name: 'Circles' })).toHaveAttribute(
      'href',
      '/circles',
    );
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/search',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Support' }));
    expect(screen.getByRole('link', { name: 'Safety' })).toHaveAttribute(
      'href',
      '/safety',
    );
    fireEvent.click(screen.getByRole('button', { name: /avatar/i }));
    expect(screen.getAllByText('Alice Example').length).toBe(2);
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Statistics' })).toHaveAttribute(
      'href',
      '/statistics',
    );
    const wikiLink = screen.getByRole('link', { name: 'Wiki' });
    expect(wikiLink).toHaveAttribute('href', 'https://wiki.trustroots.org/');
    expect(wikiLink).toHaveAttribute('target', '_blank');
    expect(wikiLink).toHaveAttribute('rel', 'noopener noreferrer');
    const volunteeringLink = screen.getByRole('link', {
      name: 'Volunteering',
    });
    expect(volunteeringLink).toHaveAttribute('target', '_blank');
    expect(volunteeringLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      screen.queryByRole('link', { name: 'Contribute' }),
    ).not.toBeInTheDocument();
  });

  it('forwards signout click to callback', () => {
    const onSignout = jest.fn();

    render(
      <NavigationLoggedIn
        currentPath="/search"
        onSignout={onSignout}
        user={user}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /avatar/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Sign out' }));

    expect(onSignout).toHaveBeenCalledTimes(1);
  });

  it('marks active menu item for current path', () => {
    render(
      <NavigationLoggedIn
        currentPath="/messages"
        onSignout={jest.fn()}
        user={user}
      />,
    );

    const messagesLink = screen.getByRole('link', { name: 'Messages' });
    expect(messagesLink.closest('li')).toHaveClass('active');
  });
});

import React, { type ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import NavigationLoggedIn from '@/modules/core/client/components/NavigationLoggedIn';

type AuthUser = ComponentProps<typeof NavigationLoggedIn>['user'];

function requireElement<T extends HTMLElement>(element: T | null): T {
  if (!element) throw new Error('Expected navigation element');
  return element;
}

jest.mock('@/modules/users/client/components/Avatar.component.js', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockAvatar() {
    return <span>avatar</span>;
  }

  return MockAvatar;
});

describe('<NavigationLoggedIn />', () => {
  const user: AuthUser = {
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
    const supportMenu = requireElement(
      requireElement(
        screen.getByRole('button', { name: 'Support' }).closest('li'),
      ).querySelector<HTMLElement>('.dropdown-menu'),
    );
    expect(
      within(supportMenu).getByRole('link', { name: 'Safety' }),
    ).toHaveAttribute('href', '/safety');
    expect(
      within(supportMenu).getByRole('link', { name: 'Report a bug' }),
    ).toHaveAttribute('href', '/support?category=reportBug');
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
    expect(volunteeringLink).toHaveAttribute(
      'href',
      '/support?category=volunteering',
    );
    expect(volunteeringLink).not.toHaveAttribute('target');
    expect(
      screen.queryByRole('link', { name: 'Contribute' }),
    ).not.toBeInTheDocument();
  });

  it('places the administrator shortcut immediately before Circles', () => {
    render(
      <NavigationLoggedIn
        currentPath="/admin"
        onSignout={jest.fn()}
        user={{ ...user, roles: ['user', 'admin'] }}
      />,
    );
    const admin = screen.getByRole('link', { name: 'Admin', exact: true });
    expect(admin).toHaveAttribute('href', '/admin');
    expect(admin.closest('li')).toHaveClass('active', 'hidden-xs');
    const adminListItem = requireElement(admin.closest('li'));
    const circlesListItem = requireElement(
      screen.getByRole('link', { name: 'Circles' }).closest('li'),
    );
    expect(adminListItem.nextElementSibling).toBe(circlesListItem);
  });

  it.each([undefined, [], ['user']])(
    'omits the administrator shortcut for non-admin roles %j',
    (roles: string[] | undefined) => {
      render(
        <NavigationLoggedIn
          currentPath="/circles"
          onSignout={jest.fn()}
          user={{ ...user, roles }}
        />,
      );
      expect(
        screen.queryByRole('link', { name: 'Admin', exact: true }),
      ).not.toBeInTheDocument();
    },
  );

  it('links Greeters to acquisition stories and administrators to admin tools', () => {
    const { rerender } = render(
      <NavigationLoggedIn
        currentPath="/admin/acquisition-stories"
        onSignout={jest.fn()}
        user={{ ...user, roles: ['user', 'welcome-team'] }}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Admin', exact: true }),
    ).toHaveAttribute('href', '/admin/acquisition-stories');
    rerender(
      <NavigationLoggedIn
        currentPath="/admin"
        onSignout={jest.fn()}
        user={{ ...user, roles: ['user', 'admin'] }}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Admin', exact: true }),
    ).toHaveAttribute('href', '/admin');
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

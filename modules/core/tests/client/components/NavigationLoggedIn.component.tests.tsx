import React, { type ComponentProps } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import NavigationLoggedIn from '@/modules/core/client/components/NavigationLoggedIn';
import {
  listMemberships,
  type MembershipUpdate,
} from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api', () => ({
  listMemberships: jest.fn(),
}));
const mockListMemberships = jest.mocked(listMemberships);

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
  beforeEach(() => {
    mockListMemberships.mockReset();
    mockListMemberships.mockResolvedValue([]);
  });

  it.each([{ roles: ['support-team'] }, { roles: ['support-team', 'admin'] }])(
    'opens the permitted staff landing page for %j',
    ({ roles }) => {
      render(
        <NavigationLoggedIn
          currentPath="/admin/support"
          onSignout={jest.fn()}
          user={{ _id: 'fictional-support', username: 'support', roles }}
        />,
      );
      expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
        'href',
        roles.includes('admin') ? '/admin' : '/admin/support',
      );
    },
  );
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
    expect(screen.getByRole('link', { name: 'Search hosts' })).toHaveAttribute(
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
    fireEvent.click(screen.getByRole('button', { name: 'Profile menu' }));
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
    const admin = screen.getByRole('link', { name: 'Admin' });
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
        screen.queryByRole('link', { name: 'Admin' }),
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
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin/acquisition-stories',
    );
    rerender(
      <NavigationLoggedIn
        currentPath="/admin"
        onSignout={jest.fn()}
        user={{ ...user, roles: ['user', 'admin'] }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin',
    );
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

    fireEvent.click(screen.getByRole('button', { name: 'Profile menu' }));
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

  it('lists only the ten largest own circles without changing membership order', async () => {
    const member = Array.from({ length: 12 }, (_, index) => ({
      tribe: {
        _id: `circle-${index}`,
        slug: `circle-${index}`,
        label: `Circle ${index}`,
        count: index * 10,
      },
    }));
    mockListMemberships.mockResolvedValue([...member, {}]);
    render(
      <NavigationLoggedIn
        currentPath="/circles"
        onSignout={jest.fn()}
        user={{ ...user, member }}
      />,
    );
    await screen.findByRole('link', { name: 'Circle 11' });
    const item = requireElement(
      screen.getByRole('link', { name: 'Circles' }).closest('li'),
    );
    expect(item).toHaveClass('dropdown', 'header-link-dropdown', 'active');
    const menu = requireElement(
      item.querySelector<HTMLElement>('.dropdown-menu'),
    );
    expect(menu).toHaveClass('hidden-xs');
    const links = within(menu).getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual(
      Array.from({ length: 10 }, (_, index) => `Circle ${11 - index}`),
    );
    expect(links[0]).toHaveAttribute('href', '/circles/circle-11');
    expect(member[0].tribe._id).toBe('circle-0');
  });

  it.each([undefined, []])('omits an empty circles menu for %j', member => {
    render(
      <NavigationLoggedIn
        currentPath="/search"
        onSignout={jest.fn()}
        user={{ ...user, member }}
      />,
    );
    const item = requireElement(
      screen.getByRole('link', { name: 'Circles' }).closest('li'),
    );
    expect(item.querySelector('.dropdown-menu')).toBeNull();
    expect(item).not.toHaveClass('dropdown');
    expect(
      screen.getByRole('link', { name: 'Find member by name' }),
    ).toHaveAttribute('href', '/search/members');
  });

  it('puts Hackers first even when it would fall outside the ten largest circles', async () => {
    const member = Array.from({ length: 12 }, (_, index) => ({
      tribe: {
        _id: `circle-${index}`,
        slug: index === 0 ? 'hackers' : `circle-${index}`,
        label: index === 0 ? 'Hackers' : `Circle ${index}`,
        count: index,
      },
    }));
    mockListMemberships.mockResolvedValue(member);
    render(
      <NavigationLoggedIn
        currentPath="/circles"
        onSignout={jest.fn()}
        user={{ ...user, member }}
      />,
    );
    await screen.findByRole('link', { name: 'Hackers' });
    const item = requireElement(
      screen.getByRole('link', { name: 'Circles' }).closest('li'),
    );
    const menu = requireElement(
      item.querySelector<HTMLElement>('.dropdown-menu'),
    );
    const links = within(menu).getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual([
      'Hackers',
      ...Array.from({ length: 9 }, (_, index) => `Circle ${11 - index}`),
    ]);
    expect(links[0]).toHaveAttribute('href', '/circles/hackers');
  });

  it('keeps primary links available when memberships fail to load', async () => {
    mockListMemberships.mockRejectedValue(new Error('Unavailable'));
    await act(async () => {
      render(
        <NavigationLoggedIn
          currentPath="/search"
          onSignout={jest.fn()}
          user={user}
        />,
      );
    });
    expect(screen.getByRole('link', { name: 'Circles' })).toHaveAttribute(
      'href',
      '/circles',
    );
    expect(
      screen.getByRole('link', { name: 'Find member by name' }),
    ).toHaveAttribute('href', '/search/members');
  });

  it('ignores stale membership responses after the user changes', async () => {
    let resolveMemberships!: (value: MembershipUpdate[]) => void;
    mockListMemberships.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMemberships = resolve;
      }),
    );
    const { rerender } = render(
      <NavigationLoggedIn
        currentPath="/search"
        onSignout={jest.fn()}
        user={user}
      />,
    );
    rerender(
      <NavigationLoggedIn
        currentPath="/search"
        onSignout={jest.fn()}
        user={{ ...user, _id: 'user-2' }}
      />,
    );
    await act(async () => {
      resolveMemberships([
        { tribe: { _id: 'old', slug: 'old', label: 'Old circle', count: 1 } },
      ]);
    });
    expect(
      screen.queryByRole('link', { name: 'Old circle' }),
    ).not.toBeInTheDocument();
  });
});

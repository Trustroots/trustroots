import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import NavigationMenuItem from '@/modules/core/client/components/NavigationMenuItem';
import NavigationSubMenuList from '@/modules/core/client/components/NavigationSubMenuList';

type NavigationSubMenu = React.ComponentProps<
  typeof NavigationSubMenuList
>['list'];

describe('navigation menu helpers', () => {
  it.each(['Search', 'Find member'])(
    'releases pointer focus from %s in a dropdown',
    name => {
      const onClick = jest.fn();
      render(
        <NavigationMenuItem
          currentPath="/"
          path="/search"
          onClick={onClick}
          submenu={<a href="/search/members">Find member</a>}
        >
          Search
        </NavigationMenuItem>,
      );
      const link = screen.getByRole('link', { name, exact: true });
      link.focus();
      fireEvent.click(link, { detail: 1 });
      expect(link).not.toHaveFocus();
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves keyboard focus in a dropdown and handles clicks outside its links', () => {
    const { container } = render(
      <NavigationMenuItem
        currentPath="/"
        path="/search"
        submenu={<a href="/search/members">Find member</a>}
      >
        Search
      </NavigationMenuItem>,
    );
    const link = screen.getByRole('link', { name: 'Search', exact: true });
    link.focus();
    fireEvent.click(link, { detail: 0 });
    expect(link).toHaveFocus();
    fireEvent.click(container.firstChild as Element, { detail: 1 });
    expect(link).toHaveFocus();
  });

  it('preserves pointer focus for navigation items without a submenu', () => {
    render(
      <NavigationMenuItem currentPath="/" path="/messages">
        Messages
      </NavigationMenuItem>,
    );
    const link = screen.getByRole('link', { name: 'Messages' });
    link.focus();
    fireEvent.click(link, { detail: 1 });
    expect(link).toHaveFocus();
  });

  it('marks the current navigation item as active and forwards link attributes', () => {
    const { container } = render(
      <NavigationMenuItem
        currentPath="/search"
        path="/search"
        target="_blank"
        className="nav-extra"
        aria-label="Search hosts"
      >
        Search
      </NavigationMenuItem>,
    );

    expect(container.firstChild).toHaveClass('active', 'nav-extra');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/search',
    );
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('renders submenu links from configuration', () => {
    const list: NavigationSubMenu = [
      { href: '/about', label: 'About' },
      { href: '/privacy', label: 'Privacy' },
    ];

    render(<NavigationSubMenuList list={list} />);

    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/about',
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});

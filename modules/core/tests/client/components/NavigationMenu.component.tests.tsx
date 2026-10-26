import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import NavigationMenuItem from '@/layers/shell/client/components/NavigationMenuItem';
import NavigationSubMenuList from '@/layers/shell/client/components/NavigationSubMenuList';

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
      const link = screen.getByRole('link', { name });
      link.focus();
      fireEvent.click(link, { detail: 1 });
      expect(link).not.toHaveFocus();
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves keyboard focus and releases pointer focus anywhere in a dropdown', () => {
    const { container } = render(
      <NavigationMenuItem
        currentPath="/"
        path="/search"
        submenu={<a href="/search/members">Find member</a>}
      >
        Search
      </NavigationMenuItem>,
    );
    const link = screen.getByRole('link', { name: 'Search' });
    link.focus();
    fireEvent.click(link, { detail: 0 });
    expect(link).toHaveFocus();
    fireEvent.click(container.firstChild as Element, { detail: 1 });
    expect(link).not.toHaveFocus();
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

  it('does not blur an element outside a dropdown after a pointer click', () => {
    render(
      <>
        <input aria-label="Outside navigation" />
        <NavigationMenuItem
          currentPath="/"
          path="/search"
          submenu={<a href="/search/members">Find member</a>}
        >
          Search
        </NavigationMenuItem>
      </>,
    );
    const outsideInput = screen.getByRole('textbox', {
      name: 'Outside navigation',
    });
    outsideInput.focus();

    fireEvent.click(screen.getByRole('link', { name: 'Search' }), {
      detail: 1,
    });

    expect(outsideInput).toHaveFocus();
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
    expect(screen.getByRole('link', { name: 'Search hosts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(container.firstChild).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('link', { name: 'Search hosts' })).toHaveAttribute(
      'href',
      '/search',
    );
    expect(screen.getByRole('link', { name: 'Search hosts' })).toHaveAttribute(
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

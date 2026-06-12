import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import NavigationMenuItem from '@/modules/core/client/components/NavigationMenuItem';
import NavigationSubMenuList from '@/modules/core/client/components/NavigationSubMenuList';

describe('navigation menu helpers', () => {
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
    render(
      <NavigationSubMenuList
        list={[
          { href: '/about', label: 'About' },
          { href: '/privacy', label: 'Privacy' },
        ]}
      />,
    );

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

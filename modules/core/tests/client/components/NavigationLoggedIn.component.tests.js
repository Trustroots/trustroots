import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import NavigationLoggedIn from '@/modules/core/client/components/NavigationLoggedIn';

jest.mock('react-bootstrap', () => {
  const React = require('react');
  const PropTypes = require('prop-types');

  function NavbarHeader({ children }) {
    return <div>{children}</div>;
  }
  NavbarHeader.propTypes = { children: PropTypes.node };

  function NavbarBrand({ children }) {
    return <div>{children}</div>;
  }
  NavbarBrand.propTypes = { children: PropTypes.node };

  const Navbar = {
    Header: NavbarHeader,
    Brand: NavbarBrand,
  };

  function Nav({ children, className }) {
    return <div className={className}>{children}</div>;
  }
  Nav.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
  };

  function NavDropdown({ children, title, className, id }) {
    return (
      <div className={className} id={id}>
        {title}
        {children}
      </div>
    );
  }
  NavDropdown.propTypes = {
    children: PropTypes.node,
    title: PropTypes.node,
    className: PropTypes.string,
    id: PropTypes.string,
  };

  function MenuItem({ children, href, target, onClick, divider }) {
    return divider ? (
      <hr role="separator" />
    ) : (
      <a href={href || '#'} target={target} onClick={onClick}>
        {children}
      </a>
    );
  }
  MenuItem.propTypes = {
    children: PropTypes.node,
    href: PropTypes.string,
    target: PropTypes.string,
    onClick: PropTypes.func,
    divider: PropTypes.bool,
  };

  return {
    Navbar,
    Nav,
    NavDropdown,
    MenuItem,
  };
});

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
    expect(screen.getAllByText('Alice Example').length).toBe(2);
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/',
    );
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

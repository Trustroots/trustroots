import PropTypes from 'prop-types';
import classnames from 'classnames';
import React, { type ReactNode } from 'react';

type NavigationMenuItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  children: ReactNode;
  className?: string;
  currentPath: string;
  path: string;
  target?: string;
  submenu?: ReactNode;
};

export default function NavigationMenuItem({
  children,
  className,
  currentPath,
  path,
  target,
  submenu,
  onClick,
  ...rest
}: NavigationMenuItemProps) {
  return (
    <li
      className={classnames(className, {
        active: path === currentPath,
      })}
      {...rest}
      onClick={event => {
        // Pointer navigation can retain link focus after the route changes.
        // Release it so moving away closes the menu; preserve keyboard focus.
        if (submenu && event.detail > 0) {
          (event.target as Element).closest<HTMLAnchorElement>('a')?.blur();
        }
        onClick?.(event);
      }}
    >
      <a href={path} target={target}>
        {children}
      </a>
      {submenu}
    </li>
  );
}

NavigationMenuItem.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  currentPath: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  target: PropTypes.string,
  submenu: PropTypes.node,
};

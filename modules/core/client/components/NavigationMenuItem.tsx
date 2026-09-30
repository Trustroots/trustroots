import PropTypes from 'prop-types';
import classnames from 'classnames';
import React, { type ReactNode } from 'react';

type NavigationMenuItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  children: ReactNode;
  className?: string;
  currentPath: string;
  path: string;
  target?: string;
};

export default function NavigationMenuItem({
  children,
  className,
  currentPath,
  path,
  target,
  ...rest
}: NavigationMenuItemProps) {
  return (
    <li
      className={classnames(className, {
        active: path === currentPath,
      })}
      {...rest}
    >
      <a href={path} target={target}>
        {children}
      </a>
    </li>
  );
}

NavigationMenuItem.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  currentPath: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  target: PropTypes.string,
};

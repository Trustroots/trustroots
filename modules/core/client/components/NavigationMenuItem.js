// External dependencies
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

export default function NavigationMenuItem({
  children,
  className,
  currentPath,
  path,
  target,
  ...rest
}) {
  return (
    <li
      className={classnames(className, {
        active: path === currentPath,
      })}
      {...rest}
    >
      <a href={path} target={target}>{children}</a>
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

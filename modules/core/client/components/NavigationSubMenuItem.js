// External dependencies
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

export default function NavigationSubMenuItem({ label, path, currentPath }) {
  return (
    <li key={path} className={classnames({ active: currentPath === path })}>
      <a href={path}>{label}</a>
    </li>
  );
}

NavigationSubMenuItem.propTypes = {
  label: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  currentPath: PropTypes.string.isRequired,
};

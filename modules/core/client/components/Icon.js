// External dependencies
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

export default function Icon({ className, icon, fixedWidth = false, size }) {
  return (
    <i
      className={classnames('icon', `icon-${icon}`, className, {
        'icon-fw': fixedWidth,
        'icon-lg': size === 'lg',
        'icon-2x': size === '2x',
        'icon-3x': size === '3x',
        'icon-4x': size === '4x',
        'icon-5x': size === '5x',
      })}
    />
  );
}

Icon.propTypes = {
  className: PropTypes.string,
  fixedWidth: PropTypes.bool,
  icon: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['lg', '2x', '3x', '4x', '5x']),
};

import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

export default function Switch({ checked, children, onChange, small }) {
  // Angular Directive supports also these CSS classes:
  // tr-switch-right
  return (
    <label
      className={classnames('tr-switch', {
        'tr-switch-sm': small,
      })}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      <div className="toggle"></div> {children}
    </label>
  );
}

Switch.propTypes = {
  checked: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
  onChange: PropTypes.func.isRequired,
  small: PropTypes.bool,
};

import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

export default function Switch({ checked, children, onChange, isSmall }) {
  // Angular Directive supports also `tr-switch-right` CSS class
  return (
    <label
      className={classnames('tr-switch', {
        'tr-switch-sm': isSmall,
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
  isSmall: PropTypes.bool,
};

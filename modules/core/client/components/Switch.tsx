import React, { type ChangeEvent, type ReactNode } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

type SwitchProps = {
  checked: boolean;
  children: ReactNode;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isSmall?: boolean;
};

export default function Switch({
  checked,
  children,
  onChange,
  isSmall,
}: SwitchProps) {
  // The legacy `tr-switch-right` CSS class is still supported.
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

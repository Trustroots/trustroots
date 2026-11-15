import React, { type ChangeEvent, type ReactNode } from 'react';
import { clsx } from 'clsx';

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
      className={clsx('tr-switch', {
        'tr-switch-sm': isSmall,
      })}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      <div className="toggle"></div> {children}
    </label>
  );
}

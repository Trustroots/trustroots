import React, { type ComponentProps } from 'react';
import './primitives.css';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'default';
};

export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`tr-button tr-button--${variant} ${className}`}
    />
  );
}

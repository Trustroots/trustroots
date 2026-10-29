import React, { type ComponentProps } from 'react';
import './primitives.css';

type AlertProps = ComponentProps<'div'>;

export function Alert({ className = '', ...props }: AlertProps) {
  return <div {...props} role="alert" className={`tr-alert ${className}`} />;
}

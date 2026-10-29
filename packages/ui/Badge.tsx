import React, { type ComponentProps } from 'react';
import './primitives.css';

export function Badge({ className = '', ...props }: ComponentProps<'span'>) {
  return <span {...props} className={`tr-badge ${className}`} />;
}

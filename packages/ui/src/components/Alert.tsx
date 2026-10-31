import React, { type ComponentProps } from 'react';

type AlertProps = ComponentProps<'div'>;

const alertClassName =
  'tw:relative tw:mb-4 tw:rounded-md tw:border tw:border-solid tw:border-warning-border tw:bg-warning-bg tw:p-4 tw:text-warning-text';

export function Alert({ className = '', ...props }: AlertProps) {
  return (
    <div {...props} role="alert" className={`${alertClassName} ${className}`} />
  );
}

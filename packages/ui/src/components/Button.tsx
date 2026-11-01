import React, { type ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'default';
};

const buttonClassName =
  'tw:inline-block tw:cursor-pointer tw:rounded-base tw:border tw:border-solid tw:border-transparent tw:px-control-x tw:py-control-y tw:text-center tw:[font-family:inherit] tw:[font-size:inherit] tw:[font-style:inherit] tw:[font-weight:inherit] tw:leading-base tw:enabled:hover:brightness-95 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-text tw:focus-visible:outline-solid tw:disabled:cursor-not-allowed tw:disabled:opacity-65';

const variantClassNames = {
  primary: 'tw:bg-brand-primary tw:text-white',
  default: 'tw:bg-white tw:text-brand-primary',
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
      className={`${buttonClassName} ${variantClassNames[variant]} ${className}`}
    />
  );
}

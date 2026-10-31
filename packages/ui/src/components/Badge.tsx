import React, { type ComponentProps } from 'react';

const badgeClassName =
  'tw:inline-block tw:rounded-base tw:bg-brand-primary tw:px-[0.65em] tw:py-[0.35em] tw:text-center tw:text-[0.75em] tw:leading-none tw:font-bold tw:text-white';

export function Badge({ className = '', ...props }: ComponentProps<'span'>) {
  return <span {...props} className={`${badgeClassName} ${className}`} />;
}

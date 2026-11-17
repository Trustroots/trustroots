import React, { type ComponentProps } from 'react';
import { cn } from '#lib/cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'tw:block tw:box-border tw:h-[34px] tw:w-full tw:appearance-none tw:rounded-[2px] tw:border tw:border-solid tw:border-[#ced4da] tw:bg-white tw:bg-clip-padding tw:px-3 tw:py-1.5 tw:text-sm tw:leading-[1.428571429] tw:text-[#333] tw:shadow-none',
        'tw:transition-[border-color,box-shadow] tw:duration-150 tw:ease-in-out tw:motion-reduce:transition-none',
        'tw:focus:border-[#86b7fe] tw:focus:[box-shadow:0_0_0_.25rem_#0d6efd40] tw:focus:outline-none tw:disabled:bg-[#e9ecef] tw:disabled:opacity-100',
        className,
      )}
    />
  );
}

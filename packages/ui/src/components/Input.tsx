import React, { type ComponentProps } from 'react';
import { cn } from '#lib/cn';

type InputProps = ComponentProps<'input'> & {
  fieldSize?: 'lg';
};

export function Input({ className, fieldSize, ...props }: InputProps) {
  return (
    <input
      {...props}
      data-slot="input"
      className={cn(
        'tw:block tw:box-border tw:w-full tw:appearance-none tw:rounded-base tw:border tw:border-solid tw:bg-white tw:bg-clip-padding tw:shadow-none',
        'tw:transition-[border-color,box-shadow] tw:duration-150 tw:ease-in-out tw:motion-reduce:transition-none',
        'tw:focus:border-[#86b7fe] tw:focus:[box-shadow:0_0_0_.25rem_#0d6efd40] tw:focus:outline-none tw:disabled:bg-[#e9ecef] tw:disabled:opacity-100',
        fieldSize === 'lg'
          ? 'tw:h-[46px] tw:border-[#dee2e6] tw:px-(--tr-padding-large-horizontal) tw:py-(--tr-padding-large-vertical) tw:text-(length:--tr-font-size-large) tw:leading-normal tw:text-[#212529]'
          : 'tw:h-[34px] tw:border-[#ced4da] tw:px-3 tw:py-1.5 tw:text-sm tw:leading-[1.428571429] tw:text-[#333]',
        className,
      )}
    />
  );
}

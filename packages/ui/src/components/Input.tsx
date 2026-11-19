import React, { type ComponentProps } from 'react';
import { cn } from '#lib/cn';
import {
  fieldBase,
  fieldPlaceholder,
  fieldSizes,
  fieldState,
} from '#lib/fieldStyles';

type InputProps = ComponentProps<'input'> & {
  fieldSize?: keyof typeof fieldSizes;
};

export function Input({ className, fieldSize = 'md', ...props }: InputProps) {
  return (
    <input
      {...props}
      data-slot="input"
      className={cn(
        fieldBase,
        fieldSizes[fieldSize],
        fieldState,
        fieldSize === 'sm' ? 'tw:h-[34px]' : fieldPlaceholder,
        fieldSize === 'lg' && 'tw:h-[46px]',
        'tw:shadow-none',
        props.type === 'file' &&
          'tw:overflow-hidden tw:file:-my-1.5 tw:file:-ms-3 tw:file:me-3 tw:file:border-0 tw:file:border-e tw:file:border-solid tw:file:border-[#dee2e6] tw:file:bg-[#f8f9fa] tw:file:px-3 tw:file:py-1.5 tw:file:text-inherit',
        props.type === 'range' && 'tw:appearance-auto tw:accent-brand-primary',
        className,
      )}
    />
  );
}

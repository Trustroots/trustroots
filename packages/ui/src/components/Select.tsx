import React, { type ComponentProps } from 'react';
import { cn } from '#lib/cn';
import { fieldBase, fieldSizes, fieldState } from '#lib/fieldStyles';

type SelectProps = ComponentProps<'select'> & {
  fieldSize?: 'md' | 'lg';
};

export function Select({ className, fieldSize = 'md', ...props }: SelectProps) {
  return (
    <select
      {...props}
      data-slot="select"
      className={cn(
        fieldBase,
        fieldSizes[fieldSize],
        fieldState,
        fieldSize === 'lg' && 'tw:h-[46px]',
        className,
      )}
    />
  );
}

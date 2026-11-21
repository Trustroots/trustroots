import React, { type ComponentProps } from 'react';
import { cn } from '#lib/cn';
import {
  fieldBase,
  fieldPlaceholder,
  fieldSizes,
  fieldState,
} from '#lib/fieldStyles';

type TextareaProps = ComponentProps<'textarea'> & {
  fieldSize?: 'md' | 'lg';
};

export function Textarea({
  className,
  fieldSize = 'lg',
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      data-slot="textarea"
      className={cn(
        fieldBase,
        fieldSizes[fieldSize],
        fieldState,
        'tw:min-h-[calc(1.5em+.75rem+2px)] tw:resize-y',
        fieldSize === 'lg' ? 'tw:h-[46px]' : fieldPlaceholder,
        className,
      )}
    />
  );
}

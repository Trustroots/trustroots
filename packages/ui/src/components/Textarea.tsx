import React, { type ComponentProps } from 'react';
import { cn } from '#lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className={cn(
        'tw:block tw:box-border tw:h-[46px] tw:min-h-[calc(1.5em+.75rem+2px)] tw:w-full tw:resize-y tw:appearance-none tw:rounded-[2px] tw:border tw:border-solid tw:border-[#dee2e6] tw:bg-white tw:bg-clip-padding tw:px-4 tw:py-2.5 tw:text-[18px] tw:leading-[1.5] tw:font-normal tw:text-[#212529]',
        'tw:transition-[border-color,box-shadow] tw:duration-150 tw:ease-in-out tw:motion-reduce:transition-none',
        'tw:focus:border-[#86b7fe] tw:focus:[box-shadow:0_0_0_.25rem_#0d6efd40] tw:focus:outline-none tw:disabled:bg-[#e9ecef] tw:disabled:opacity-100',
        className,
      )}
    />
  );
}

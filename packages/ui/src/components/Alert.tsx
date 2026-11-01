import React, { type ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils';

// Bootstrap 5.3 `.alert` geometry, with its contextual colours as tones.
const alertVariants = cva(
  'tw:relative tw:mb-4 tw:rounded-md tw:border tw:border-solid tw:p-4 tw:text-shadow-none',
  {
    variants: {
      tone: {
        danger: 'tw:border-danger-border tw:bg-danger-bg tw:text-danger-text',
        info: 'tw:border-info-border tw:bg-info-bg tw:text-info-text',
        success:
          'tw:border-success-border tw:bg-success-bg tw:text-success-text',
        warning:
          'tw:border-warning-border tw:bg-warning-bg tw:text-warning-text',
      },
      align: {
        start: '',
        center: 'tw:text-center',
      },
    },
    defaultVariants: {
      align: 'start',
    },
  },
);

type AlertProps = Omit<ComponentProps<'div'>, 'role'> &
  VariantProps<typeof alertVariants> & {
    tone: NonNullable<VariantProps<typeof alertVariants>['tone']>;
    /**
     * Required so each caller decides how assistive technology hears it:
     * `alert` for errors that need attention now, `status` for outcomes
     * announced politely, `note` for static advice. `dialog` is for the one
     * alert that acts as an overlay guide.
     */
    role: 'alert' | 'status' | 'note' | 'dialog';
  };

export function Alert({ tone, align, className, ...props }: AlertProps) {
  return (
    <div {...props} className={cn(alertVariants({ tone, align }), className)} />
  );
}

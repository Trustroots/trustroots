import React, { type ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import type { Intent } from '#lib/intent';
import { cn } from '#lib/cn';

/*
 * Bootstrap 5.3 `.alert` geometry. The tints are Bootstrap's own subtle
 * variables, which the app's Bootstrap stylesheet defines on :root.
 */
const alertVariants = cva(
  'tw:relative tw:mb-4 tw:rounded-md tw:border tw:border-solid tw:p-4 tw:text-shadow-none',
  {
    variants: {
      intent: {
        danger:
          'tw:border-(--tr-danger-border-subtle) tw:bg-(--tr-danger-bg-subtle) tw:text-(--tr-danger-text-emphasis)',
        info: 'tw:border-(--tr-info-border-subtle) tw:bg-(--tr-info-bg-subtle) tw:text-(--tr-info-text-emphasis)',
        success:
          'tw:border-(--tr-success-border-subtle) tw:bg-(--tr-success-bg-subtle) tw:text-(--tr-success-text-emphasis)',
        warning:
          'tw:border-(--tr-warning-border-subtle) tw:bg-(--tr-warning-bg-subtle) tw:text-(--tr-warning-text-emphasis)',
      },
    },
  },
);

/** Alerts take the four status intents. */
export type AlertIntent = Extract<
  Intent,
  'danger' | 'info' | 'success' | 'warning'
>;

type AlertProps = Omit<ComponentProps<'div'>, 'role'> & {
  intent: AlertIntent;
  /**
   * Required so each caller decides how assistive technology hears it:
   * `alert` for errors that need attention now, `status` for outcomes
   * announced politely, `note` for static advice.
   */
  role: 'alert' | 'status' | 'note';
};

export function Alert({ intent, className, ...props }: AlertProps) {
  return (
    <div
      data-intent={intent}
      {...props}
      className={cn(alertVariants({ intent }), className)}
    />
  );
}

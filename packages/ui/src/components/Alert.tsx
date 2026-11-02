import React, { type ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import type { Intent } from '#lib/intent';
import { cn } from '#lib/utils';

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
          'tw:border-(--bs-danger-border-subtle) tw:bg-(--bs-danger-bg-subtle) tw:text-(--bs-danger-text-emphasis)',
        info: 'tw:border-(--bs-info-border-subtle) tw:bg-(--bs-info-bg-subtle) tw:text-(--bs-info-text-emphasis)',
        success:
          'tw:border-(--bs-success-border-subtle) tw:bg-(--bs-success-bg-subtle) tw:text-(--bs-success-text-emphasis)',
        warning:
          'tw:border-(--bs-warning-border-subtle) tw:bg-(--bs-warning-bg-subtle) tw:text-(--bs-warning-text-emphasis)',
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
   * announced politely, `note` for static advice. `dialog` is for the one
   * alert that acts as an overlay guide.
   */
  role: 'alert' | 'status' | 'note' | 'dialog';
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

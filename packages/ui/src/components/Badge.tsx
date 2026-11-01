import React, { type ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '#lib/utils';

/*
 * Small inline status text: counts, tags and states. Adapted from shadcn's
 * Badge to the existing Trustroots look.
 *
 * Every badge has a 1px border so solid and outline badges of one size have
 * the same box; a solid badge's border is transparent and its background
 * shows through it. Sizes use the metrics of the badges they replaced:
 * `md` is Bootstrap's `.badge` and scales with the surrounding text.
 */
const badgeVariants = cva(
  'tw:inline-block tw:border tw:border-solid tw:text-center tw:whitespace-nowrap',
  {
    variants: {
      variant: {
        solid: 'tw:border-transparent tw:text-white',
        outline: 'tw:border-current tw:bg-transparent',
      },
      tone: {
        neutral: '',
        primary: '',
        success: '',
        warning: '',
        danger: '',
        inverse: '',
      },
      size: {
        md: 'tw:rounded-md tw:px-[0.65em] tw:py-[0.35em] tw:text-[0.75em] tw:leading-none tw:font-bold',
        sm: 'tw:rounded-md tw:px-[0.65em] tw:py-[0.35em] tw:text-[11px] tw:leading-[10px]',
        // The unread-messages counter in the header.
        xs: 'tw:rounded tw:px-[2px] tw:py-0 tw:text-[10px] tw:leading-[1.3] tw:font-normal tw:text-shadow-[0_-1px_0_rgb(0_0_0/0.4)]',
      },
      shape: {
        rounded: '',
        pill: 'tw:rounded-full',
      },
    },
    compoundVariants: [
      { variant: 'solid', tone: 'neutral', className: 'tw:bg-neutral' },
      { variant: 'solid', tone: 'primary', className: 'tw:bg-brand-primary' },
      { variant: 'solid', tone: 'success', className: 'tw:bg-success' },
      { variant: 'solid', tone: 'warning', className: 'tw:bg-warning' },
      { variant: 'solid', tone: 'danger', className: 'tw:bg-notification' },
      { variant: 'outline', tone: 'neutral', className: 'tw:text-neutral' },
      { variant: 'outline', tone: 'inverse', className: 'tw:text-white' },
      { variant: 'solid', size: 'sm', className: 'tw:font-semibold' },
      { variant: 'outline', size: 'sm', className: 'tw:font-extralight' },
    ],
    defaultVariants: {
      size: 'md',
      shape: 'rounded',
    },
  },
);

type BadgeVariants = VariantProps<typeof badgeVariants>;

export type BadgeProps = ComponentProps<'span'> & {
  variant: NonNullable<BadgeVariants['variant']>;
  tone: NonNullable<BadgeVariants['tone']>;
  size?: NonNullable<BadgeVariants['size']>;
  shape?: NonNullable<BadgeVariants['shape']>;
  /** Shows a notification dot, for example for pending items. */
  indicator?: boolean;
};

export function Badge({
  className,
  variant,
  tone,
  size = 'md',
  shape = 'rounded',
  indicator = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      data-tone={tone}
      data-size={size}
      data-shape={shape}
      className={cn(badgeVariants({ variant, tone, size, shape }), className)}
      {...props}
    >
      {children}
      {indicator && (
        <span
          data-slot="badge-indicator"
          aria-hidden="true"
          className="tw:absolute tw:top-[6px] tw:right-[9px] tw:block tw:size-[7px] tw:rounded-full tw:bg-notification"
        />
      )}
    </span>
  );
}

export { badgeVariants };

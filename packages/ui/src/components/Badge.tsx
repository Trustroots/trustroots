import React, { type ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import { intentClassNames, type Intent } from '#lib/intent';
import { cn } from '#lib/utils';

/*
 * Small inline status text: counts, tags and states. Adapted from shadcn's
 * Badge to the existing Trustroots look. Like Button, the intent sets
 * `--intent` and `--on-intent` and the variant reads them.
 *
 * Every badge has a 1px border so solid and outline badges of one size have
 * the same box; a solid badge's border is transparent and its background
 * shows through it. `md` is Bootstrap's `.badge` and scales with the
 * surrounding text; `sm` is the profile counts and tags.
 */
const badgeVariants = cva(
  'tw:inline-block tw:rounded-md tw:border tw:border-solid tw:text-center tw:whitespace-nowrap',
  {
    variants: {
      variant: {
        solid: 'tw:border-transparent tw:bg-(--intent) tw:text-(--on-intent)',
        outline: 'tw:border-current tw:bg-transparent tw:text-(--intent)',
      },
      intent: intentClassNames,
      size: {
        md: 'tw:px-[0.65em] tw:py-[0.35em] tw:text-[0.75em] tw:leading-none tw:font-bold',
        sm: 'tw:px-[0.65em] tw:py-[0.35em] tw:text-[11px] tw:leading-[10px]',
      },
    },
    compoundVariants: [
      { variant: 'solid', size: 'sm', className: 'tw:font-semibold' },
      { variant: 'outline', size: 'sm', className: 'tw:font-extralight' },
    ],
  },
);

export type BadgeProps = ComponentProps<'span'> & {
  variant: 'solid' | 'outline';
  intent: Intent;
  /** Defaults to `md`. */
  size?: 'sm' | 'md';
};

export function Badge({
  className,
  variant,
  intent,
  size = 'md',
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      data-intent={intent}
      data-size={size}
      {...props}
      className={cn(badgeVariants({ variant, intent, size }), className)}
    />
  );
}

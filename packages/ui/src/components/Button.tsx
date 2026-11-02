import React, { createContext, useContext, type ReactElement } from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { useRender } from '@base-ui/react/use-render';
import { cva } from 'class-variance-authority';

import { intentClassNames, type Intent } from '#lib/intent';
import { cn } from '#lib/utils';

/*
 * Started from shadcn's Base UI button. The intent sets `--intent` and
 * `--on-intent`; variants only read them, so any variant takes any intent.
 * Text colours repeat on :hover and :focus so they beat the app's
 * `a:hover` and `a:focus` rules when the button renders as a link.
 */
const buttonVariants = cva(
  [
    'tw:inline-block tw:cursor-pointer tw:select-none tw:border tw:border-solid tw:text-center tw:align-middle',
    'tw:font-base tw:font-normal tw:not-italic tw:no-underline tw:text-shadow-none',
    'tw:transition-[color,background-color,border-color,box-shadow] tw:duration-150 tw:ease-[ease-in-out] tw:motion-reduce:transition-none',
    // One keyboard focus ring for every look, offset so it reads on any fill.
    'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-solid tw:focus-visible:outline-text',
    'tw:disabled:pointer-events-none tw:disabled:opacity-65',
  ],
  {
    variants: {
      variant: {
        solid: [
          'tw:border-(--intent) tw:bg-(--intent) tw:text-(--on-intent) tw:[&:hover,&:focus]:text-(--on-intent)',
          'tw:hover:bg-[color-mix(in_oklab,var(--intent),black_6%)] tw:focus-visible:bg-[color-mix(in_oklab,var(--intent),black_6%)]',
          // A label holding a checked radio stays pressed.
          'tw:active:bg-[color-mix(in_oklab,var(--intent),black_10%)] tw:has-checked:bg-[color-mix(in_oklab,var(--intent),black_10%)]',
        ],
        outline: [
          'tw:border-(--intent) tw:bg-transparent tw:text-(--intent) tw:[&:hover,&:focus]:text-(--intent)',
          'tw:hover:bg-[color-mix(in_oklab,var(--intent)_10%,transparent)] tw:active:bg-[color-mix(in_oklab,var(--intent)_10%,transparent)]',
        ],
        ghost:
          'tw:border-transparent tw:bg-transparent tw:text-text tw:[&:hover,&:focus]:text-text',
        link: 'tw:border-transparent tw:bg-transparent tw:text-link tw:underline tw:hover:text-link-hover tw:disabled:text-muted',
      },
      intent: intentClassNames,
      size: {
        xs: 'tw:rounded-xs tw:px-1.25 tw:py-px tw:text-xs tw:leading-normal tw:[--py:--spacing(0.25)]',
        sm: 'tw:rounded-sm tw:px-2 tw:py-1 tw:text-sm tw:leading-normal tw:[--py:--spacing(1)]',
        md: 'tw:rounded-md tw:px-3 tw:py-1.5 tw:text-base tw:leading-normal tw:[--py:--spacing(1.5)]',
        lg: 'tw:rounded-lg tw:px-4 tw:py-2 tw:text-xl tw:leading-normal tw:[--py:--spacing(2)]',
        xl: 'tw:rounded-lg tw:px-7.5 tw:py-3.75 tw:text-xl tw:leading-normal tw:[--py:--spacing(3.75)]',
      },
      // A circle: the size's vertical padding on every side.
      round: { true: 'tw:rounded-[50%] tw:px-(--py)' },
    },
    compoundVariants: [
      // Muted links, such as "Help!" under a form.
      {
        variant: 'link',
        intent: 'neutral',
        className: 'tw:text-muted tw:[&:hover,&:focus]:text-muted',
      },
      // On a dark background the ring is white, like the button.
      {
        variant: 'outline',
        intent: 'inverse',
        className: 'tw:focus-visible:outline-white',
      },
    ],
  },
);

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonGroupContextValue {
  size?: ButtonSize;
  orientation: 'horizontal' | 'vertical';
}

export const ButtonGroupContext = createContext<ButtonGroupContextValue | null>(
  null,
);

/*
 * Inside a ButtonGroup, buttons join up: inner corners are square and
 * neighbouring borders overlap, as with Bootstrap's `.btn-group`.
 */
const groupClassNames = {
  horizontal:
    'tw:relative tw:flex-[1_1_auto] tw:hover:z-1 tw:focus:z-1 tw:active:z-1 tw:not-first:-ms-px tw:not-first:rounded-s-none tw:not-last:rounded-e-none',
  vertical:
    'tw:relative tw:w-full tw:flex-[1_1_auto] tw:hover:z-1 tw:focus:z-1 tw:active:z-1 tw:not-first:-mt-px tw:not-first:rounded-t-none tw:not-last:rounded-b-none',
};

export type ButtonProps = Omit<
  ButtonPrimitive.Props,
  'className' | 'render'
> & {
  /** How the button is drawn. Defaults to `solid`. */
  variant?: ButtonVariant;
  /** Its colour. Defaults to `inverse`: white with brand-green text. */
  intent?: Intent;
  /** Defaults to the group's size, or `md`. */
  size?: ButtonSize;
  round?: boolean;
  className?: string;
  /**
   * Renders the button look on another element, such as a link:
   * `render={<a href="/signup" />}`. The element keeps its own semantics;
   * a link stays a link.
   */
  render?: ReactElement;
};

/** The props that pick a button's look, for components that pass one on. */
export type ButtonStyleProps = Pick<ButtonProps, 'variant' | 'intent' | 'size'>;

export function Button({
  variant = 'solid',
  intent = 'inverse',
  size,
  round = false,
  className,
  render,
  ...props
}: ButtonProps) {
  const group = useContext(ButtonGroupContext);
  const resolvedSize = size ?? group?.size ?? 'md';
  const classes = cn(
    buttonVariants({ variant, intent, size: resolvedSize, round }),
    group && groupClassNames[group.orientation],
    className,
  );
  const dataProps = {
    'data-slot': 'button',
    'data-variant': variant,
    'data-intent': intent,
    'data-size': resolvedSize,
  };
  if (render) {
    return (
      <RenderedButton
        render={render}
        {...dataProps}
        {...props}
        className={classes}
      />
    );
  }
  return <ButtonPrimitive {...dataProps} {...props} className={classes} />;
}

function RenderedButton({
  render,
  ref,
  ...props
}: {
  render: ReactElement;
  ref?: React.Ref<HTMLElement>;
} & Record<string, unknown>) {
  return useRender({ render, ref, props });
}

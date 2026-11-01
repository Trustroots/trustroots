import React, { createContext, useContext, type ReactElement } from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { useRender } from '@base-ui/react/use-render';
import { cva } from 'class-variance-authority';

import { cn } from '#lib/utils';

/*
 * Started from shadcn's Base UI button and rebuilt to the Trustroots look:
 * the sizes, colours and states of the Bootstrap and Less button classes
 * (`btn`, `btn-primary`, `btn-lg`, …) it replaces.
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
        solid: '',
        inverse: 'tw:bg-transparent',
        offer: 'tw:text-white tw:[&:hover]:text-white tw:[&:focus]:text-white',
        link: 'tw:border-transparent tw:bg-transparent tw:underline tw:disabled:text-link-disabled',
        plain:
          'tw:border-transparent tw:bg-transparent tw:text-plain tw:[&:hover]:text-text tw:[&:focus]:text-text',
      },
      colour: {
        default: '',
        primary: '',
        danger: '',
        info: '',
        white: '',
        yes: '',
        maybe: '',
        no: '',
        meet: '',
        link: '',
        muted: '',
      },
      size: {
        xs: 'tw:rounded-xs tw:px-1.25 tw:py-px tw:text-[length:var(--tr-font-size-small)] tw:leading-normal',
        sm: 'tw:rounded-sm tw:px-2 tw:py-1 tw:text-sm tw:leading-normal',
        md: 'tw:rounded-md tw:px-3 tw:py-1.5 tw:text-base tw:leading-normal',
        lg: 'tw:rounded-lg tw:px-4 tw:py-2 tw:text-xl tw:leading-normal',
        action:
          'tw:rounded-lg tw:px-7.5 tw:py-3.75 tw:text-xl tw:leading-normal',
      },
      round: {
        true: 'tw:rounded-[50%]',
        false: '',
      },
      raised: {
        // The Less rule lost its shadow on hover; kept as it was.
        true: 'tw:[box-shadow:0_1px_4px_rgba(0,0,0,0.2)] tw:hover:[box-shadow:none]',
        false: '',
      },
      block: {
        true: 'tw:block tw:w-full',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'solid',
        colour: 'default',
        className:
          'tw:border-button-default tw:bg-button-default tw:text-brand-primary tw:[&:hover]:text-brand-primary tw:[&:focus]:text-brand-primary tw:hover:bg-button-default-hover tw:focus-visible:bg-button-default-hover tw:active:bg-button-default-active',
      },
      {
        variant: 'solid',
        colour: 'primary',
        className:
          'tw:border-brand-primary tw:bg-brand-primary tw:text-white tw:[&:hover]:text-white tw:[&:focus]:text-white tw:hover:border-button-primary-hover tw:hover:bg-button-primary-hover tw:focus-visible:border-button-primary-hover tw:focus-visible:bg-button-primary-hover tw:active:border-button-primary-active tw:active:bg-button-primary-active',
      },
      {
        variant: 'solid',
        colour: 'danger',
        className:
          'tw:border-danger tw:bg-danger tw:text-white tw:[&:hover]:text-white tw:[&:focus]:text-white tw:hover:border-danger-hover-border tw:hover:bg-danger-hover tw:focus-visible:border-danger-hover-border tw:focus-visible:bg-danger-hover tw:active:border-danger-active-border tw:active:bg-danger-hover-border',
      },
      {
        variant: 'solid',
        colour: 'info',
        className:
          'tw:border-info tw:bg-info tw:text-black tw:[&:hover]:text-black tw:[&:focus]:text-black tw:hover:border-info-hover-border tw:hover:bg-info-hover tw:focus-visible:border-info-hover-border tw:focus-visible:bg-info-hover tw:active:border-info-hover-border tw:active:bg-info-active',
      },
      {
        variant: 'inverse',
        colour: 'white',
        className:
          'tw:border-white tw:text-white tw:[&:hover]:text-white tw:[&:focus]:text-white tw:focus-visible:outline-white tw:hover:border-[rgba(255,255,255,0.8)] tw:hover:bg-[rgba(255,255,255,0.1)] tw:active:border-[rgba(255,255,255,0.8)] tw:active:bg-[rgba(255,255,255,0.1)] tw:[&:focus:not(:hover)]:border-button-inverse-focus',
      },
      {
        variant: 'inverse',
        colour: 'primary',
        className:
          'tw:border-brand-primary tw:text-brand-primary tw:[&:hover]:text-brand-primary tw:[&:focus]:text-brand-primary tw:hover:border-[rgba(var(--tr-brand-primary-rgb),0.8)] tw:hover:bg-[rgba(var(--tr-brand-primary-rgb),0.1)] tw:active:border-[rgba(var(--tr-brand-primary-rgb),0.8)] tw:active:bg-[rgba(var(--tr-brand-primary-rgb),0.1)] tw:[&:focus:not(:hover)]:border-button-inverse-primary-focus',
      },
      {
        variant: 'offer',
        colour: 'yes',
        className:
          'tw:border-offer-yes tw:bg-offer-yes tw:hover:border-offer-yes-hover tw:hover:bg-offer-yes-hover tw:focus:border-offer-yes-hover tw:focus:bg-offer-yes-hover tw:active:border-offer-yes-active tw:active:bg-offer-yes-active tw:[&.active]:border-offer-yes-active tw:[&.active]:bg-offer-yes-active',
      },
      {
        variant: 'offer',
        colour: 'maybe',
        className:
          'tw:border-offer-maybe tw:bg-offer-maybe tw:hover:border-offer-maybe-hover tw:hover:bg-offer-maybe-hover tw:focus:border-offer-maybe-hover tw:focus:bg-offer-maybe-hover tw:active:border-offer-maybe-active tw:active:bg-offer-maybe-active tw:[&.active]:border-offer-maybe-active tw:[&.active]:bg-offer-maybe-active',
      },
      {
        variant: 'offer',
        colour: 'no',
        className:
          'tw:border-offer-no tw:bg-offer-no tw:hover:border-offer-no-hover tw:hover:bg-offer-no-hover tw:focus:border-offer-no-hover tw:focus:bg-offer-no-hover tw:active:border-offer-no-active tw:active:bg-offer-no-active tw:[&.active]:border-offer-no-active tw:[&.active]:bg-offer-no-active',
      },
      {
        variant: 'offer',
        colour: 'meet',
        className:
          'tw:border-offer-meet tw:bg-offer-meet tw:hover:border-offer-meet-hover tw:hover:bg-offer-meet-hover tw:focus:border-offer-meet-hover tw:focus:bg-offer-meet-hover tw:active:border-offer-meet-active tw:active:bg-offer-meet-active tw:[&.active]:border-offer-meet-active tw:[&.active]:bg-offer-meet-active',
      },
      {
        variant: 'link',
        colour: 'link',
        className:
          'tw:text-link tw:hover:text-link-hover tw:[&:focus-visible:not(:hover)]:text-link tw:active:text-link-hover',
      },
      {
        variant: 'link',
        colour: 'muted',
        className:
          'tw:text-button-muted tw:[&:hover]:text-button-muted tw:[&:focus]:text-button-muted',
      },
      // Round buttons have equal padding on every side.
      { round: true, size: 'xs', className: 'tw:p-px' },
      { round: true, size: 'sm', className: 'tw:p-1.25' },
      { round: true, size: 'md', className: 'tw:p-1.5' },
      { round: true, size: 'lg', className: 'tw:p-2.5' },
      { round: true, size: 'action', className: 'tw:p-3.75' },
    ],
    defaultVariants: {
      variant: 'solid',
      colour: 'default',
      size: 'md',
      round: false,
      raised: false,
      block: false,
    },
  },
);

/**
 * The colours each variant comes in; the first is its default.
 * @variantDefaults colour by variant
 */
const colours = {
  solid: ['default', 'primary', 'danger', 'info'],
  inverse: ['white', 'primary'],
  offer: ['yes', 'maybe', 'no', 'meet'],
  link: ['link', 'muted'],
  plain: [],
} as const;

type Colours = typeof colours;
export type ButtonVariant = keyof Colours;
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'action';

/** A variant with one of its own colours. */
export type ButtonLook = {
  [V in ButtonVariant]: {
    variant: V;
    colour?: Colours[V][number];
  };
}[ButtonVariant];

export type ButtonStyleProps = (
  ButtonLook | { variant?: undefined; colour?: Colours['solid'][number] }
) & {
  size?: ButtonSize;
  /** A circle: equal padding on every side, fully rounded. */
  round?: boolean;
  /** A slight shadow under the button. */
  raised?: boolean;
  /** Full width. */
  block?: boolean;
};

/** Class names for a button look, for elements that cannot use `Button`. */
export function buttonClassName({
  variant = 'solid',
  colour,
  size = 'md',
  round = false,
  raised = false,
  block = false,
  className,
}: ButtonStyleProps & { className?: string }) {
  return cn(
    buttonVariants({
      variant,
      colour: colour ?? colours[variant][0] ?? 'default',
      size,
      round,
      raised,
      block,
    }),
    className,
  );
}

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

export type ButtonProps = Omit<ButtonPrimitive.Props, 'className' | 'render'> &
  ButtonStyleProps & {
    className?: string;
    /**
     * Renders the button look on another element, such as a link:
     * `render={<a href="/signup" />}`. The element keeps its own semantics;
     * a link stays a link.
     */
    render?: ReactElement;
  };

export function Button({
  variant = 'solid',
  colour,
  size,
  round,
  raised,
  block,
  className,
  render,
  ...props
}: ButtonProps) {
  const group = useContext(ButtonGroupContext);
  const resolvedSize = size ?? group?.size ?? 'md';
  const resolvedColour = colour ?? colours[variant][0];
  const classes = cn(
    buttonClassName({
      variant,
      colour: resolvedColour,
      size: resolvedSize,
      round,
      raised,
      block,
    } as ButtonStyleProps),
    group && groupClassNames[group.orientation],
    className,
  );
  const dataProps = {
    'data-slot': 'button',
    'data-variant': variant,
    'data-colour': resolvedColour,
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

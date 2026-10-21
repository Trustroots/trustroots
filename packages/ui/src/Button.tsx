import React, {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type Ref,
} from 'react';

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'link'
  | 'danger'
  | 'warning'
  | 'warn'
  | 'info'
  | 'inverse'
  | 'inverse-primary';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

type OwnProps<T extends ElementType> = {
  as?: T;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  action?: boolean;
  round?: boolean;
  raised?: boolean;
  className?: string;
};

export type ButtonProps<T extends ElementType = 'button'> = OwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof OwnProps<T>> & {
    ref?: Ref<unknown>;
  };

function ButtonImpl(
  {
    as,
    variant,
    size,
    block,
    action,
    round,
    raised,
    className,
    ...props
  }: ButtonProps<ElementType>,
  ref: Ref<unknown>,
) {
  const Component: ElementType = as ?? 'button';
  const classNames = [
    'btn',
    variant && `btn-${variant}`,
    size && `btn-${size}`,
    block && 'btn-block',
    action && 'btn-action',
    round && 'btn-round',
    raised && 'btn-raised',
    className,
  ].filter(Boolean);

  return <Component {...props} ref={ref} className={classNames.join(' ')} />;
}

const Button = forwardRef(ButtonImpl) as <T extends ElementType = 'button'>(
  props: ButtonProps<T>,
) => ReactElement | null;

export default Button;

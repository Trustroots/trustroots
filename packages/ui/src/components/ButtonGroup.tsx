import React, { useContext, type ComponentProps } from 'react';

import { cn } from '#lib/utils';

import { ButtonGroupContext, type ButtonSize } from './Button';

type ButtonGroupProps = ComponentProps<'div'> & {
  /** Size of every button in the group. */
  size?: ButtonSize;
  orientation?: 'horizontal' | 'vertical';
  /** Stretch the group to full width, sharing it equally between children. */
  justified?: boolean;
};

/*
 * A group nested in a horizontal group joins its neighbours the way a button
 * does: it overlaps the previous border and squares its buttons' inner corners.
 */
const nestedClassName =
  'tw:not-first:-ms-px tw:not-first:*:rounded-s-none tw:not-last:*:rounded-e-none';

/**
 * Joins buttons into one control, like Bootstrap's `.btn-group`. Give it
 * `role="group"` and a label where the buttons form one choice.
 */
export function ButtonGroup({
  size,
  orientation = 'horizontal',
  justified = false,
  className,
  children,
  ...props
}: ButtonGroupProps) {
  const parent = useContext(ButtonGroupContext);
  return (
    <ButtonGroupContext.Provider
      value={{ size: size ?? parent?.size, orientation }}
    >
      <div
        data-slot="button-group"
        data-orientation={orientation}
        {...props}
        className={cn(
          'tw:relative tw:inline-flex tw:align-middle',
          orientation === 'horizontal' && 'tw:rounded-[0.375rem]',
          orientation === 'vertical' &&
            'tw:flex-col tw:items-start tw:justify-center',
          justified && 'tw:flex tw:w-full tw:*:flex-1',
          parent?.orientation === 'horizontal' && nestedClassName,
          className,
        )}
      >
        {children}
      </div>
    </ButtonGroupContext.Provider>
  );
}

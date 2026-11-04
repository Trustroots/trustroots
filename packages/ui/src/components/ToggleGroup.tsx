import React, { createContext, useContext, type ReactNode } from 'react';

import { cn } from '#lib/utils';

/*
 * A single choice drawn as joined buttons, like Bootstrap's radio toggle
 * buttons. Each option is a native radio inside its label: arrow keys move
 * and select within the group, Tab reaches the checked option, and a disabled
 * fieldset disables the options. Base UI's ToggleGroup has pressed-button
 * semantics and its Radio ignores fieldsets, so neither fits here.
 */

interface ToggleGroupContextValue {
  name: string;
  value: string | null;
  onValueChange: (value: string) => void;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

type ToggleGroupProps<Value extends string> = {
  /** Shared by the radios, so the browser treats them as one group. */
  name: string;
  /** The checked option, or `null` when none is chosen yet. */
  value: Value | null;
  onValueChange: (value: Value) => void;
  /** The id of the question the options answer. */
  'aria-labelledby': string;
  children: ReactNode;
};

export function ToggleGroup<Value extends string>({
  name,
  value,
  onValueChange,
  children,
  ...props
}: ToggleGroupProps<Value>) {
  return (
    <ToggleGroupContext.Provider
      value={{
        name,
        value,
        onValueChange: onValueChange as (value: string) => void,
      }}
    >
      <div
        data-slot="toggle-group"
        role="radiogroup"
        {...props}
        className="tw:relative tw:inline-flex tw:rounded-md tw:align-middle"
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

/*
 * Bootstrap 5.3 `.btn-outline-secondary.btn-lg` after a `.btn-check`. Inside
 * the group, inner corners are square and neighbouring borders overlap.
 */
const toggleClassName = cn(
  'tw:relative tw:inline-block tw:flex-[1_1_auto] tw:cursor-pointer tw:select-none tw:align-middle tw:text-center',
  'tw:m-0 tw:rounded-lg tw:border tw:border-solid tw:px-4 tw:py-2 tw:text-xl tw:leading-normal tw:font-normal',
  'tw:border-(--bs-secondary) tw:bg-transparent tw:text-(--bs-secondary)',
  'tw:has-checked:bg-(--bs-secondary) tw:has-checked:text-white',
  'tw:has-focus-visible:shadow-[0_0_0_0.25rem_rgb(var(--bs-secondary-rgb)/0.5)]',
  'tw:hover:z-1 tw:has-checked:z-1 tw:has-focus-visible:z-1',
  'tw:has-disabled:pointer-events-none tw:has-disabled:opacity-65',
  'tw:transition-[color,background-color,border-color,box-shadow] tw:duration-150 tw:ease-in-out tw:motion-reduce:transition-none',
  'tw:not-first:-ms-px tw:not-first:rounded-s-none tw:not-last:rounded-e-none',
);

type ToggleGroupItemProps = {
  value: string;
  children: ReactNode;
};

export function ToggleGroupItem({ value, children }: ToggleGroupItemProps) {
  // Only rendered inside a ToggleGroup.
  const group = useContext(ToggleGroupContext)!;
  return (
    <label data-slot="toggle-group-item" className={toggleClassName}>
      <input
        type="radio"
        className="tw:sr-only"
        name={group.name}
        value={value}
        checked={group.value === value}
        onChange={() => group.onValueChange(value)}
      />
      {children}
    </label>
  );
}

import React, {
  createContext,
  useContext,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cva } from 'class-variance-authority';

import { cn } from '#lib/utils';

/*
 * Bootstrap 5.3 `.nav-tabs` and `.nav-pills` geometry on Base UI's tabs.
 * Colours with no `--tr-*` token are Bootstrap's own variables, which the
 * app's Bootstrap stylesheet defines on :root, as in Alert.
 */
const tabsListVariants = cva('tw:flex tw:flex-wrap tw:ps-0 tw:mb-0', {
  variants: {
    variant: {
      tabs: 'tw:border-x-0 tw:border-t-0 tw:border-b tw:border-solid tw:border-(--bs-border-color)',
      pills: '',
    },
  },
});

const tabVariants = cva(
  [
    'tw:block tw:px-4 tw:py-2 tw:bg-transparent tw:text-link tw:no-underline',
    'tw:[&:hover,&:focus]:text-link-hover',
    'tw:transition-[color,background-color,border-color] tw:duration-150 tw:ease-in-out tw:motion-reduce:transition-none',
    // Bootstrap's `.nav-link` focus ring.
    'tw:focus-visible:outline-0 tw:focus-visible:shadow-[0_0_0_0.25rem_rgb(13_110_253/0.25)]',
    'tw:data-disabled:pointer-events-none tw:data-disabled:cursor-default',
    'tw:data-disabled:not-data-active:text-(--bs-secondary-color)',
  ],
  {
    variants: {
      variant: {
        tabs: [
          'tw:-mb-px tw:border tw:border-solid tw:border-transparent tw:rounded-t-md',
          'tw:not-data-active:[&:hover,&:focus]:isolate tw:not-data-active:[&:hover,&:focus]:[border-color:var(--bs-secondary-bg)_var(--bs-secondary-bg)_var(--bs-border-color)]',
          'tw:data-active:text-(--bs-emphasis-color) tw:data-active:[&:hover,&:focus]:text-(--bs-emphasis-color) tw:data-active:bg-(--bs-body-bg)',
          'tw:data-active:[border-color:var(--bs-border-color)_var(--bs-border-color)_var(--bs-body-bg)]',
        ],
        // Bootstrap's default pill colour, which the step pills have shown
        // since the move to Bootstrap 5.
        pills:
          'tw:border-0 tw:rounded-md tw:data-active:bg-[#0d6efd] tw:data-active:text-white tw:data-active:[&:hover,&:focus]:text-white',
      },
      // Tabs share the row equally, like Bootstrap's `.nav-justified`.
      justified: { true: 'tw:grow tw:basis-0 tw:text-center' },
    },
  },
);

export type TabsVariant = 'tabs' | 'pills';

const TabsListContext = createContext<{
  variant: TabsVariant;
  justified: boolean;
}>({ variant: 'tabs', justified: false });

type TabValue = string | number;

type TabsProps<Value extends TabValue> = {
  /** The active tab's value. Tabs are always controlled. */
  value: Value;
  /** Called with the tab a person picks, by click or arrow key. */
  onValueChange: (value: Value) => void;
  children: ReactNode;
};

/**
 * Tabs with their panels. Arrow keys move between tabs and select the one
 * they land on, skipping disabled tabs and wrapping at the ends.
 */
export function Tabs<Value extends TabValue>({
  value,
  onValueChange,
  children,
}: TabsProps<Value>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      value={value}
      onValueChange={next => onValueChange(next as Value)}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

type TabsListProps = {
  /** `tabs` draws Bootstrap's bordered tabs, `pills` its rounded pills. */
  variant: TabsVariant;
  /** Share the full width equally between the tabs. */
  justified?: boolean;
  className?: string;
  children: ReactNode;
};

/*
 * Base UI lets arrow keys stop on disabled tabs, as the ARIA pattern allows.
 * The app's tabs have always skipped them, so arrows move to the previous or
 * next enabled tab in document order, wrapping at the ends; Home and End do
 * nothing.
 */
const arrowSteps: Record<string, number> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
  Home: 0,
  End: 0,
};

function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (!(event.key in arrowSteps)) return;
  event.preventDefault();
  event.stopPropagation();
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="tab"]:not([aria-disabled="true"])',
    ),
  );
  const index = tabs.indexOf(event.target as HTMLElement);
  const next = (index + arrowSteps[event.key] + tabs.length) % tabs.length;
  // Focusing a tab selects it, through `activateOnFocus`.
  tabs[next].focus();
}

export function TabsList({
  variant,
  justified = false,
  className,
  children,
}: TabsListProps) {
  return (
    <TabsListContext.Provider value={{ variant, justified }}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        activateOnFocus
        onKeyDownCapture={moveFocus}
        className={cn(tabsListVariants({ variant }), className)}
      >
        {children}
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  );
}

type TabProps = {
  value: TabValue;
  disabled?: boolean;
  children: ReactNode;
};

export function Tab({ value, disabled = false, children }: TabProps) {
  const { variant, justified } = useContext(TabsListContext);
  return (
    <TabsPrimitive.Tab
      data-slot="tab"
      value={value}
      disabled={disabled}
      // Disabled tabs are not tab stops, even when selected.
      {...(disabled && { tabIndex: -1 })}
      className={tabVariants({ variant, justified })}
    >
      {children}
    </TabsPrimitive.Tab>
  );
}

type TabsPanelProps = {
  value: TabValue;
  children: ReactNode;
  'aria-label'?: string;
};

/**
 * A tab's content. Hidden panels stay mounted, so maps and form fields keep
 * their state, and a panel fades in when shown, like Bootstrap's `.fade`.
 * The panel being left hides at once, so two panels never show together.
 */
export function TabsPanel({ value, ...props }: TabsPanelProps) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      value={value}
      keepMounted
      {...props}
      className="tw:transition-opacity tw:duration-150 tw:ease-linear tw:starting:opacity-0 tw:motion-reduce:transition-none tw:data-ending-style:hidden"
    />
  );
}

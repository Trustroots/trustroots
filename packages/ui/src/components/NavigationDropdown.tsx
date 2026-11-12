import React, { useRef, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';

type NavigationDropdownProps = {
  id: string;
  label: ReactNode;
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
};

export function NavigationDropdown({
  id,
  label,
  children,
  className,
  align = 'start',
}: NavigationDropdownProps) {
  const listItem = useRef<HTMLLIElement>(null);

  return (
    <li className={className} ref={listItem}>
      <Popover.Root>
        <Popover.Trigger
          id={id}
          className="tw:after:ms-[.255em] tw:after:inline-block tw:after:align-[.255em] tw:after:border-x-[.3em] tw:after:border-x-transparent tw:after:border-t-[.3em] tw:after:border-t-current tw:after:border-b-0 tw:after:border-solid"
          data-slot="navigation-dropdown-trigger"
          openOnHover
          delay={0}
        >
          {label}
        </Popover.Trigger>
        <Popover.Portal container={listItem}>
          <Popover.Positioner align={align} className="tw:z-[1000]">
            <Popover.Popup
              aria-labelledby={id}
              initialFocus={false}
              data-slot="navigation-dropdown-panel"
              className="tw:navigation-panel tw:max-h-(--available-height) tw:overflow-auto"
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </li>
  );
}

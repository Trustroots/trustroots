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
          className="dropdown-toggle"
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
              className="dropdown-menu show tw:static! tw:max-h-(--available-height) tw:overflow-auto"
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </li>
  );
}

import classnames from 'classnames';
import React, { type ReactNode } from 'react';

type NavigationMenuItemProps = React.LiHTMLAttributes<HTMLLIElement> & {
  children: ReactNode;
  className?: string;
  currentPath: string;
  path: string;
  target?: string;
  submenu?: ReactNode;
};

export default function NavigationMenuItem({
  children,
  className,
  currentPath,
  path,
  target,
  submenu,
  onClick,
  ...rest
}: NavigationMenuItemProps) {
  return (
    <li
      className={classnames(className, {
        active: path === currentPath,
      })}
      {...rest}
      onClick={event => {
        // Pointer navigation can retain focus inside the menu after the route
        // changes. Release it so moving away closes the menu, including when
        // the click lands on padding rather than a link. Preserve keyboard focus.
        if (submenu && event.detail > 0) {
          const focused = document.activeElement;
          if (
            focused instanceof HTMLElement &&
            event.currentTarget.contains(focused)
          ) {
            focused.blur();
          }
        }
        onClick?.(event);
      }}
    >
      <a href={path} target={target}>
        {children}
      </a>
      {submenu}
    </li>
  );
}

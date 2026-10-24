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
  'aria-label': ariaLabel,
  ...rest
}: NavigationMenuItemProps) {
  return (
    // Clicks bubble from native links; this handler only releases pointer focus.
    // Keyboard navigation remains on the links, including submenu links.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
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
      <a
        href={path}
        target={target}
        aria-label={ariaLabel}
        aria-current={path === currentPath ? 'page' : undefined}
      >
        {children}
      </a>
      {submenu}
    </li>
  );
}

import React from 'react';

type SubMenuItem = {
  href: string;
  label: string;
  rel?: string;
  target?: string;
};

type NavigationSubMenuListProps = { list: SubMenuItem[] };

export default function NavigationSubMenuList({
  list,
}: NavigationSubMenuListProps) {
  return (
    <div className="font-brand-regular tw:px-2.5 tw:text-center tw:text-[0.875em]">
      <ul className="tw:m-0 tw:mb-4 tw:flex tw:list-none tw:flex-wrap tw:justify-center tw:gap-x-2.5 tw:p-0">
        {list.map(({ href, label, rel, target }) => (
          <li key={href}>
            <a
              className="tw:wrap-anywhere tw:text-muted"
              href={href}
              rel={rel}
              target={target}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

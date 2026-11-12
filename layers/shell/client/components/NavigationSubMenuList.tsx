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
    <div className="header-menu-meta font-brand-regular">
      <ul className="header-menu-meta-links">
        {list.map(({ href, label, rel, target }) => (
          <li key={href}>
            <a href={href} rel={rel} target={target}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

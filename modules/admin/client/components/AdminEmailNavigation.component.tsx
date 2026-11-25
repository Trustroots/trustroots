import React from 'react';

const pages = [
  { path: '/admin/email', label: 'Email queue overview' },
  { path: '/admin/email/sparkpost', label: 'SparkPost delivery and recovery' },
  { path: '/admin/email/replies', label: 'Email replies' },
] as const;

export default function AdminEmailNavigation({
  current,
}: {
  current: (typeof pages)[number]['path'];
}) {
  return (
    <nav
      aria-label="Email administration"
      className="tw:mb-4 tw:flex tw:flex-wrap tw:gap-x-4 tw:gap-y-1"
    >
      {pages.map(({ path, label }) => (
        <a
          key={path}
          href={path}
          aria-current={path === current ? 'page' : undefined}
          className="tw:aria-[current=page]:font-semibold"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

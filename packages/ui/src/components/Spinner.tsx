import React from 'react';

const spinnerClassName =
  'tw:inline-block tw:size-[1em] tw:animate-spinner tw:rounded-full tw:border-[0.2em] tw:border-solid tw:border-current tw:border-r-transparent tw:align-[-0.125em] tw:motion-reduce:[animation-duration:1.5s]';

export function Spinner({ label }: { label: string }) {
  return (
    <span className={spinnerClassName} role="status">
      <span className="tw:sr-only">{label}</span>
    </span>
  );
}

import React, { useId, type ReactNode } from 'react';

interface SearchFilterSwitchProps {
  checked: boolean;
  children: ReactNode;
  count?: number;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export default function SearchFilterSwitch({
  checked,
  children,
  count,
  disabled,
  onChange,
}: SearchFilterSwitchProps) {
  const labelId = useId();
  const countId = `${labelId}-count`;

  return (
    <label className="tw:relative tw:inline-flex tw:min-h-6 tw:cursor-pointer tw:items-center tw:gap-2.5 tw:font-normal tw:text-text tw:has-disabled:cursor-default">
      <input
        aria-describedby={count === undefined ? undefined : countId}
        aria-labelledby={labelId}
        checked={checked}
        className="tw:peer tw:absolute tw:top-0 tw:left-0 tw:m-0! tw:h-6 tw:w-10 tw:opacity-0"
        disabled={disabled}
        onChange={event => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className="tw:pointer-events-none tw:relative tw:h-6 tw:w-10 tw:shrink-0 tw:rounded-full tw:bg-(--tr-control-neutral) tw:after:absolute tw:after:top-0.5 tw:after:left-0.5 tw:after:size-5 tw:after:rounded-full tw:after:bg-white tw:after:content-[''] tw:peer-checked:bg-brand-primary tw:peer-checked:after:translate-x-4 tw:peer-focus-visible:outline-2 tw:peer-focus-visible:outline-offset-2 tw:peer-disabled:opacity-50"
      />
      <span id={labelId}>{children}</span>
      {count !== undefined && (
        <>
          <small aria-hidden="true" className="tw:text-muted tw:tabular-nums">
            {count.toLocaleString()}
          </small>
          <span className="tw:sr-only" id={countId}>
            Map results {count.toLocaleString()}
          </span>
        </>
      )}
    </label>
  );
}

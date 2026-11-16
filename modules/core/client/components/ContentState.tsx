import React, { type ReactNode } from 'react';
import { Alert } from '@trustroots/ui/Alert';
import { Spinner } from '@trustroots/ui/Spinner';

type ContentStateProps = {
  kind: 'loading' | 'empty' | 'error';
  heading: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Consistent, announced heading and explanation for asynchronous content states. */
export default function ContentState({
  kind,
  heading,
  description,
  action,
  children,
  className,
}: ContentStateProps) {
  if (kind === 'error') {
    return (
      <Alert
        className={`content-state content-empty ${className ?? ''}`}
        intent="danger"
        role="alert"
      >
        <h3>{heading}</h3>
        <p>{description}</p>
        {action}
        {children}
      </Alert>
    );
  }

  return (
    <div
      aria-live={kind === 'loading' ? 'polite' : undefined}
      className={`content-state content-empty ${className ?? ''}`}
      role="status"
    >
      {kind === 'loading' && (
        <span aria-hidden="true">
          <Spinner label={heading} />
        </span>
      )}
      <h3>{heading}</h3>
      <p>{description}</p>
      {action}
      {children}
    </div>
  );
}

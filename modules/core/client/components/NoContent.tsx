import classnames from 'classnames';
import React, { type ReactNode } from 'react';

type NoContentProps = {
  children?: ReactNode;
  className?: string;
  icon?: string;
  message: string;
};

export default function NoContent({
  children = null,
  className,
  icon,
  message,
}: NoContentProps) {
  return (
    <div className={classnames('row content-empty', className)}>
      {icon && <i className={`icon-3x icon-${icon}`}></i>}
      <h4>{message}</h4>
      {children}
    </div>
  );
}

import React from 'react';
import { clsx } from 'clsx';

interface StatProps {
  children: React.ReactNode;
  className?: string;
  title: string;
}

export default function Stat({ children, title, className }: StatProps) {
  return (
    <div
      className={clsx(
        'panel panel-default tw:flex tw:min-w-0 tw:flex-col tw:[&.panel]:mb-0',
        className,
      )}
    >
      <div className="panel-heading">
        <h3 className="panel-title">{title}</h3>
      </div>
      <div className="panel-body tw:flex tw:grow tw:flex-col tw:items-center tw:justify-center tw:text-center">
        {children}
      </div>
    </div>
  );
}

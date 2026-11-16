import React from 'react';
import classnames from 'classnames';

interface StatProps {
  children: React.ReactNode;
  className?: string;
  title: string;
}

export default function Stat({ children, title, className }: StatProps) {
  return (
    <div
      className={classnames(
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

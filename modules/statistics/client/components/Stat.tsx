import React from 'react';
import classnames from 'classnames';
import './stat.css';

interface StatProps {
  children: React.ReactNode;
  className?: string;
  title: string;
}

export default function Stat({ children, title, className }: StatProps) {
  return (
    <div
      className={classnames('panel', 'panel-default', 'stat-panel', className)}
    >
      <div className="panel-heading">
        <h3 className="panel-title">{title}</h3>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

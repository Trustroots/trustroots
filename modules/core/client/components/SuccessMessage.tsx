import React, { type ReactNode } from 'react';
import sparklesSvg from '../img/sparkles.svg';
import './success-message.css';

type SuccessMessageProps = {
  children?: ReactNode;
  cta?: ReactNode;
  title?: string;
};

export default function SuccessMessage({
  children,
  cta,
  title,
}: SuccessMessageProps) {
  return (
    <div className="success-message">
      <img
        className="success-message-sparkles"
        src={sparklesSvg}
        alt=""
        aria-hidden
      />
      <h2 className="font-brand-light">{title}</h2>
      {children && <div className="success-message-spacer">{children}</div>}
      {cta && <div className="success-message-spacer">{cta}</div>}
    </div>
  );
}

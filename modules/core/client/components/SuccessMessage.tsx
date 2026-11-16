import React, { type ReactNode } from 'react';
import sparklesSvg from '../img/sparkles.svg';

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
    <div className="tw:mx-auto tw:flex tw:max-w-[500px] tw:flex-col tw:items-center tw:p-[30px] tw:text-center">
      <img className="tw:mb-[-50px]" src={sparklesSvg} alt="" aria-hidden />
      <h2 className="font-brand-light">{title}</h2>
      {children && <div className="tw:my-[15px]">{children}</div>}
      {cta && <div className="tw:my-[15px]">{cta}</div>}
    </div>
  );
}

import React, { type HTMLAttributes } from 'react';

export default function MessageBubble({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { className: string }) {
  return (
    <div
      {...props}
      className={[
        'message message-bubble tw:mb-4 tw:flex tw:items-end tw:gap-2 tw:[@media(max-width:767px)]:mb-3 tw:[@media(max-width:767px)]:gap-1.5',
        'tw:[&_.message-main]:min-w-0 tw:[&_.message-main]:max-w-[min(72%,640px)] tw:[&_.message-main]:flex-[0_1_auto] tw:[@media(max-width:767px)]:[&_.message-main]:max-w-[85%]',
        'tw:[&_.panel]:mb-0 tw:[&_.panel]:rounded-2xl tw:[&_.panel]:shadow-none tw:[&_.panel]:before:hidden tw:[&_.panel]:after:hidden',
        'tw:[&_.panel-body]:wrap-anywhere tw:[&_.panel-body]:px-4 tw:[&_.panel-body]:py-3 tw:[@media(max-width:767px)]:[&_.panel-body]:px-3 tw:[@media(max-width:767px)]:[&_.panel-body]:py-2.5',
        'tw:[&.message_.message-meta]:mx-1 tw:[&.message_.message-meta]:mt-0 tw:[&.message_.message-meta]:mb-1 tw:[&.message_.message-meta]:flex tw:[&.message_.message-meta]:flex-wrap tw:[&.message_.message-meta]:items-center tw:[&.message_.message-meta]:gap-1.5 tw:[&.message_.message-meta]:text-start',
        'tw:[&.message-sender-me]:justify-end tw:[&.message.message-sender-me_.message-meta]:justify-end',
        'tw:[&.message-sender-me_.panel]:rounded-ee-[4px] tw:[&.message-sender-me_.panel]:bg-[#e1f5ed] tw:[&.message-sender-me:not([data-hosting])_.panel]:border-[#c5e7da] tw:[&.message-sender-other_.panel]:rounded-es-[4px]',
        className,
      ].join(' ')}
    />
  );
}

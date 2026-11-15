import React, { type HTMLAttributes } from 'react';
import './message-bubble.css';

export default function MessageBubble({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`message message-bubble ${className}`.trim()} />
  );
}

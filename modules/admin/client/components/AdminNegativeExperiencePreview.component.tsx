import React, { useId, useRef, useState } from 'react';

interface AdminNegativeExperiencePreviewProps {
  dateLabel: string;
  feedbackPublic?: string | null;
}

export default function AdminNegativeExperiencePreview({
  dateLabel,
  feedbackPublic,
}: AdminNegativeExperiencePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const previewId = `admin-experience-feedback-${useId()}`;
  const isFocused = useRef(false);
  const isHovered = useRef(false);
  const touchActivation = useRef(false);
  const feedback = feedbackPublic?.trim() ? feedbackPublic : null;

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    touchActivation.current = event.pointerType === 'touch';
  }

  function onTouchStart() {
    touchActivation.current = true;
  }

  function onFocus() {
    isFocused.current = true;
    if (!touchActivation.current) {
      setIsOpen(true);
    }
  }

  function onBlur() {
    isFocused.current = false;
    if (!isHovered.current) {
      setIsOpen(false);
    }
  }

  function onPointerEnter(event: React.PointerEvent<HTMLSpanElement>) {
    if (event.pointerType === 'touch') {
      return;
    }

    isHovered.current = true;
    setIsOpen(true);
  }

  function onPointerLeave(event: React.PointerEvent<HTMLSpanElement>) {
    if (event.pointerType === 'touch') {
      return;
    }

    isHovered.current = false;
    if (!isFocused.current) {
      setIsOpen(false);
    }
  }

  function onClick() {
    if (touchActivation.current) {
      setIsOpen(open => !open);
      touchActivation.current = false;
      return;
    }

    setIsOpen(true);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <span
      className="admin-negative-experience-preview"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        aria-controls={previewId}
        aria-describedby={isOpen ? previewId : undefined}
        aria-expanded={isOpen}
        aria-label={`Preview public feedback from ${dateLabel}`}
        className="admin-negative-experience-preview__trigger"
        onBlur={onBlur}
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onTouchStart={onTouchStart}
        type="button"
      >
        {dateLabel}
      </button>
      <span
        className="admin-negative-experience-preview__popover"
        hidden={!isOpen}
        id={previewId}
        role="tooltip"
      >
        {feedback || 'Public feedback is unavailable.'}
      </span>
    </span>
  );
}

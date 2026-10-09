import React from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminNegativeExperiencePreview from '@/modules/admin/client/components/AdminNegativeExperiencePreview.component';

type PreviewFeedback = React.ComponentProps<
  typeof AdminNegativeExperiencePreview
>['feedbackPublic'];

function renderPreview(feedbackPublic?: PreviewFeedback) {
  const text =
    arguments.length === 0 ? 'First line\nSecond line' : feedbackPublic;
  return render(
    <AdminNegativeExperiencePreview
      dateLabel="2026-06-21"
      feedbackPublic={text}
    />,
  );
}

function getPreview() {
  return screen.getByRole('tooltip', { hidden: true });
}

describe('AdminNegativeExperiencePreview', () => {
  it('opens on hover and keeps the complete feedback as plain text', () => {
    renderPreview('First line\nSecond line <script>alert(1)</script>');
    const trigger = screen.getByRole('button', {
      name: 'Preview public feedback from 2026-06-21',
    });
    const hoverTarget = trigger.parentElement!;

    expect(getPreview()).not.toBeVisible();
    fireEvent.pointerEnter(hoverTarget, { pointerType: 'mouse' });

    expect(getPreview()).toBeVisible();
    expect(getPreview()).toHaveTextContent(
      /First line\s+Second line <script>alert\(1\)<\/script>/,
    );
    expect(getPreview().querySelector('script')).toBeNull();
    expect(getPreview()).toHaveClass(
      'admin-negative-experience-preview__popover',
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens on keyboard focus, closes on Escape, and keeps focus on the trigger', () => {
    renderPreview();
    const trigger = screen.getByRole('button', {
      name: 'Preview public feedback from 2026-06-21',
    });

    fireEvent.focus(trigger);
    trigger.focus();
    expect(getPreview()).toBeVisible();
    fireEvent.click(trigger);
    expect(getPreview()).toBeVisible();
    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(getPreview()).not.toBeVisible();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(getPreview()).not.toBeVisible();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(getPreview()).not.toBeVisible();
  });

  it('toggles by touch and closes when focus and hover leave', () => {
    renderPreview();
    const trigger = screen.getByRole('button', {
      name: 'Preview public feedback from 2026-06-21',
    });
    const hoverTarget = trigger.parentElement!;

    const touchPointerEnter = createEvent.pointerOver(hoverTarget);
    Object.defineProperty(touchPointerEnter, 'pointerType', {
      value: 'touch',
    });
    fireEvent(hoverTarget, touchPointerEnter);
    expect(getPreview()).not.toBeVisible();
    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    const touchPointerDown = createEvent.pointerDown(trigger);
    Object.defineProperty(touchPointerDown, 'pointerType', {
      value: 'touch',
    });
    fireEvent(trigger, touchPointerDown);
    trigger.focus();
    expect(getPreview()).not.toBeVisible();
    fireEvent.click(trigger);
    expect(getPreview()).toBeVisible();
    const touchPointerLeave = createEvent.pointerOut(hoverTarget);
    Object.defineProperty(touchPointerLeave, 'pointerType', {
      value: 'touch',
    });
    fireEvent(hoverTarget, touchPointerLeave);
    expect(getPreview()).toBeVisible();
    fireEvent.touchStart(trigger);
    fireEvent.click(trigger);
    expect(getPreview()).not.toBeVisible();

    fireEvent.pointerEnter(hoverTarget, { pointerType: 'mouse' });
    expect(getPreview()).toBeVisible();
    fireEvent.blur(trigger);
    expect(getPreview()).toBeVisible();
    fireEvent.pointerLeave(hoverTarget, { pointerType: 'mouse' });
    expect(getPreview()).not.toBeVisible();

    fireEvent.focus(trigger);
    fireEvent.pointerEnter(hoverTarget, { pointerType: 'mouse' });
    fireEvent.pointerLeave(hoverTarget, { pointerType: 'mouse' });
    expect(getPreview()).toBeVisible();
    fireEvent.blur(trigger);
    expect(getPreview()).not.toBeVisible();
  });

  it.each([undefined, null, '', '  \n  '] as PreviewFeedback[])(
    'shows an unavailable message for missing feedback (%s)',
    feedbackPublic => {
      renderPreview(feedbackPublic);
      const trigger = screen.getByRole('button');
      fireEvent.focus(trigger);

      expect(getPreview()).toHaveTextContent('Public feedback is unavailable.');
    },
  );
});

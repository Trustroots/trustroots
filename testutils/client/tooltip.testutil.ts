import {
  fireEvent,
  screen,
  waitFor,
  type Matcher,
} from '@testing-library/react';

// Base UI attaches a tooltip trigger's mouseenter listener in an effect that
// runs after the trigger mounts, so a hover sent straight after mounting can
// be lost on a slow machine. Hover until the tooltip text shows.
export function hoverTooltip(trigger: HTMLElement, text: Matcher) {
  return waitFor(() => {
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText(text)).toBeVisible();
  });
}

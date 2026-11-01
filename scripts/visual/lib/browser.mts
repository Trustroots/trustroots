// Shared capture helpers: viewports, frozen rendering and interaction states.
import type { BrowserContextOptions, Locator, Page } from '@playwright/test';

import type { PixelComparer } from './pixels.mts';

export interface Viewport {
  name: 'desktop' | 'mobile';
  options: BrowserContextOptions;
}

export const viewports: Viewport[] = [
  {
    name: 'desktop',
    options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  },
  {
    // A touch phone: no hover media feature, coarse pointer.
    name: 'mobile',
    options: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    },
  },
];

export const directions = ['ltr', 'rtl'] as const;
export type Direction = (typeof directions)[number];

export type InteractionState = 'rest' | 'hover' | 'focus-visible' | 'active';

/** Stops animations, transitions and the caret so renders repeat exactly. */
export const freezeCss = `
*, *::before, *::after {
  transition: none !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}`;

export async function freeze(page: Page) {
  await page.addStyleTag({ content: freezeCss });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Puts `target` into a state. Returns a function that ends it (the mouse
 * stays pressed for `active` until then).
 */
export async function enterState(
  page: Page,
  target: Locator,
  state: InteractionState,
): Promise<() => Promise<void>> {
  // Forced: a disabled button has `pointer-events: none`, so Playwright's
  // actionability check would wait for it forever. The pointer still moves
  // over it, which is what a user would do.
  if (state === 'hover') {
    await target.hover({ force: true });
  }
  if (state === 'active') {
    await target.hover({ force: true });
    await page.mouse.down();
    return () => page.mouse.up();
  }
  if (state === 'focus-visible') {
    // A key press first makes Chromium treat the next focus as keyboard focus.
    await page.keyboard.press('Shift');
    await target.focus();
    const visible = await target.evaluate(element =>
      element.matches(':focus-visible'),
    );
    if (!visible) throw new Error('Target did not get :focus-visible.');
  }
  return async () => {};
}

/**
 * Screenshots the whole viewport and crops it to `box`. Clipped Chromium
 * captures drop focus rings, so a full capture is cropped instead.
 */
export async function shootBox(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  comparer: PixelComparer,
): Promise<Buffer> {
  const full = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  return comparer.crop(
    full,
    {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    },
    0,
  );
}

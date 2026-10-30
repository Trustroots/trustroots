// Element screenshots of every packages/ui fixture and state, in LTR and RTL.
// SHOTS_DIR names the output directory; diff.spec.ts compares two of them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const shotsDir = process.env.SHOTS_DIR!;
const page = pathToFileURL(join(__dirname, 'index.html')).href;

type State = 'rest' | 'hover' | 'focus-visible' | 'active';
const fixtures: [string, State[]][] = [
  ['button-primary', ['rest', 'hover', 'focus-visible', 'active']],
  ['button-default', ['rest', 'hover', 'focus-visible', 'active']],
  ['button-primary-disabled', ['rest', 'hover']],
  ['button-default-disabled', ['rest', 'hover']],
  ['button-submit', ['rest']],
  ['alert', ['rest']],
  ['badge', ['rest']],
  ['badge-heading', ['rest']],
  ['spinner', ['rest']],
  ['spinner-heading', ['rest']],
];

async function enterState(target: Page, id: string, state: State) {
  const control = target.locator(`[data-shot="${id}"] button`);
  if (state === 'hover') await control.hover();
  if (state === 'active') {
    await control.hover();
    await target.mouse.down();
  }
  if (state === 'focus-visible') {
    // A key press first makes Chromium treat the following focus as keyboard focus.
    await target.keyboard.press('Shift');
    await control.focus();
    expect(await control.evaluate(el => el.matches(':focus-visible'))).toBe(
      true,
    );
  }
}

test.use({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 1 });

for (const dir of ['ltr', 'rtl']) {
  for (const [id, states] of fixtures) {
    for (const state of states) {
      test(`${dir} ${id} ${state}`, async ({ page: target }) => {
        mkdirSync(join(shotsDir, dir), { recursive: true });
        await target.emulateMedia({ reducedMotion: 'reduce' });
        await target.goto(`${page}?dir=${dir}`);
        const shot = target.locator(`[data-shot="${id}"]`);
        await expect(shot).toBeVisible();
        await target.evaluate(() => document.fonts.ready);
        await enterState(target, id, state);
        if (state === 'focus-visible') {
          expect(
            await target.evaluate(() =>
              document.activeElement?.matches(':focus-visible'),
            ),
          ).toBe(true);
        }
        // Chromium drops the focus ring from clipped captures, so shoot the
        // whole viewport and crop it to the fixture in a canvas.
        const box = (await shot.boundingBox())!;
        const full = await target.screenshot({
          animations: 'disabled',
          caret: 'hide',
        });
        if (state === 'active') await target.mouse.up();
        const cropped = await target.evaluate(
          async ({ src, x, y, width, height }) => {
            const image = new Image();
            image.src = src;
            await image.decode();
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext('2d')!.drawImage(image, -x, -y);
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = '';
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return btoa(binary);
          },
          {
            src: `data:image/png;base64,${full.toString('base64')}`,
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          },
        );
        writeFileSync(
          join(shotsDir, dir, `${id}--${state}.png`),
          Buffer.from(cropped, 'base64'),
        );
      });
    }
  }
}

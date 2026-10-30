// Computed styles of each fixture element, to explain pixel differences.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from '@playwright/test';

const shotsDir = process.env.SHOTS_DIR!;
const page = pathToFileURL(join(__dirname, 'index.html')).href;

const properties = [
  'display',
  'position',
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderLeftColor',
  'borderTopWidth',
  'borderStyle',
  'borderRadius',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginBottom',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'textAlign',
  'verticalAlign',
  'cursor',
  'opacity',
  'filter',
  'width',
  'height',
  'animationName',
  'animationDuration',
  'touchAction',
  'textTransform',
];

for (const dir of ['ltr', 'rtl']) {
  test(`${dir} computed styles`, async ({ page: target }) => {
    await target.goto(`${page}?dir=${dir}`);
    await target.locator('[data-shot]').first().waitFor();
    const styles = await target.evaluate(names => {
      const selectors: Record<string, string> = {
        'button-primary': '[data-shot="button-primary"] button',
        'button-default': '[data-shot="button-default"] button',
        'button-primary-disabled':
          '[data-shot="button-primary-disabled"] button',
        alert: '[data-shot="alert"] [role="alert"]',
        badge: '[data-shot="badge"] span span',
        'badge-heading': '[data-shot="badge-heading"] h3 span',
        spinner: '[data-shot="spinner"] [role="status"]',
        'spinner-label': '[data-shot="spinner"] [role="status"] span',
      };
      const result: Record<string, Record<string, string>> = {};
      for (const [id, selector] of Object.entries(selectors)) {
        const style = getComputedStyle(document.querySelector(selector)!);
        result[id] = Object.fromEntries(
          names.map(name => [name, style[name as keyof CSSStyleDeclaration]]),
        ) as Record<string, string>;
      }
      return result;
    }, properties);
    mkdirSync(shotsDir, { recursive: true });
    writeFileSync(
      join(shotsDir, `styles-${dir}.json`),
      `${JSON.stringify(styles, null, 2)}\n`,
    );
  });
}

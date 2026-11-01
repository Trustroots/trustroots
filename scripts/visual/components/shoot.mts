// Shoots every component fixture in every state, viewport and direction:
// `before` markup with the base stylesheet, `after` with the head stylesheet.
import { pathToFileURL } from 'node:url';
import type { Browser, Page } from '@playwright/test';

import {
  directions,
  enterState,
  freeze,
  shootBox,
  viewports,
  type InteractionState,
} from '../lib/browser.mts';
import type { PixelComparer } from '../lib/pixels.mts';
import { compareStyles, snapshotStyles } from '../lib/styles.mts';
import type { Comparison, Side } from '../lib/results.mts';

export interface FixtureInfo {
  id: string;
  states: InteractionState[];
  target: string;
}

export interface ComponentRun {
  browser: Browser;
  comparer: PixelComparer;
  /** Directory holding index.html and dist/fixtures.js. */
  pageDir: string;
  /** Directories holding each side's react-main.css. */
  css: Record<Side, string>;
  fixtures: FixtureInfo[];
  retries: number;
  only?: RegExp;
  save: (comparison: Comparison, images: Record<string, Buffer>) => void;
}

/** Lists the fixtures the page renders, with their states and targets. */
export async function listFixtures(
  browser: Browser,
  pageDir: string,
  css: string,
): Promise<FixtureInfo[]> {
  const page = await browser.newPage();
  await page.goto(fixtureUrl(pageDir, css, 'after', 'ltr', null));
  const list = await page.evaluate(
    () => (window as unknown as { __fixtures: FixtureInfo[] }).__fixtures ?? [],
  );
  await page.close();
  return list;
}

function fixtureUrl(
  pageDir: string,
  css: string,
  side: Side,
  dir: string,
  only: string | null,
) {
  const url = new URL(pathToFileURL(`${pageDir}/index.html`).href);
  url.searchParams.set('side', side);
  url.searchParams.set('dir', dir);
  url.searchParams.set('css', pathToFileURL(css).href);
  if (only) url.searchParams.set('only', only);
  return url.href;
}

async function capture(
  page: Page,
  run: ComponentRun,
  fixture: FixtureInfo,
  side: Side,
  dir: string,
  state: InteractionState,
) {
  await page.goto(
    fixtureUrl(run.pageDir, run.css[side], side, dir, fixture.id),
  );
  const shot = page.locator(`[data-shot="${fixture.id}"]`);
  await shot.waitFor();
  await freeze(page);
  const target = shot.locator(fixture.target).first();
  const end =
    state === 'rest' ? async () => {} : await enterState(page, target, state);
  const box = (await shot.boundingBox())!;
  const styles = await snapshotStyles(page, `[data-shot="${fixture.id}"]`);
  const png = await shootBox(page, box, run.comparer);
  await end();
  return { png, styles };
}

export async function shootComponents(run: ComponentRun) {
  for (const viewport of viewports) {
    const context = await run.browser.newContext({
      ...viewport.options,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    for (const dir of directions) {
      for (const fixture of run.fixtures) {
        for (const state of fixture.states) {
          const name = `${fixture.id}--${state}`;
          const key = `components/${viewport.name}/${dir}/${name}`;
          if (run.only && !run.only.test(key)) continue;
          const comparison: Comparison = {
            suite: 'components',
            key,
            name,
            viewport: viewport.name,
            dir,
            pixels: 0,
            styleDifferences: 0,
            styles: [],
            result: 'identical',
            box: null,
          };
          try {
            const before = await capture(
              page,
              run,
              fixture,
              'before',
              dir,
              state,
            );
            const after = await capture(
              page,
              run,
              fixture,
              'after',
              dir,
              state,
            );
            const diff = await run.comparer.compare(before.png, after.png);
            const styles = compareStyles(before.styles, after.styles);
            comparison.pixels = diff.differing;
            comparison.box = diff.box;
            comparison.styleDifferences = styles.count;
            comparison.styles = styles.differences;
            comparison.size = { width: diff.width, height: diff.height };
            const images: Record<string, Buffer> = {
              before: before.png,
              after: after.png,
            };
            if (diff.differing > 0) {
              images.diff = diff.png;
              // Component renders are deterministic; a repeat shows whether
              // the difference is stable before it is reported as real.
              let stable = true;
              for (let i = 0; i < run.retries && stable; i++) {
                const again = await capture(
                  page,
                  run,
                  fixture,
                  'after',
                  dir,
                  state,
                );
                if (again.png.equals(before.png)) stable = false;
              }
              comparison.result = stable ? 'different' : 'noise';
            } else if (styles.count > 0) {
              comparison.result = 'styles-only';
            }
            run.save(comparison, images);
          } catch (error) {
            comparison.result = 'error';
            comparison.error = String(error);
            run.save(comparison, {});
            if (!run.browser.isConnected()) {
              throw new Error(`Browser closed during ${key}`, { cause: error });
            }
          }
        }
      }
    }
    await context.close();
  }
}

// Full-page shots of every app target on the base and head servers, which
// read the same seeded database. Inputs that vary between loads are frozen.
import type { Browser, BrowserContext, Page, Route } from '@playwright/test';

import {
  directions,
  freezeCss,
  viewports,
  type Viewport,
} from '../lib/browser.mts';
import type { PixelComparer } from '../lib/pixels.mts';
import type { Comparison, Side } from '../lib/results.mts';
import {
  compareStyles,
  snapshotStyles,
  type StyleSnapshot,
} from '../lib/styles.mts';
import { USERNAMES, type Target, type VisualUser } from './routes.mts';

export interface AppRun {
  browser: Browser;
  comparer: PixelComparer;
  urls: Record<Side, string>;
  password: string;
  targets: Target[];
  retries: number;
  workers: number;
  only?: RegExp;
  save: (comparison: Comparison, images: Record<string, Buffer>) => void;
}

const FIXED_NOW = Date.UTC(2026, 9, 30, 16, 0, 0);

// A transparent 1×1 PNG for every external image, such as map tiles.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function initScript(now: number) {
  // Fixed clock and seeded Math.random.
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date> | []) {
      if (args.length === 0) super(now);
      else super(...(args as ConstructorParameters<typeof Date>));
    }
    static now() {
      return now;
    }
  }
  (window as unknown as { Date: typeof Date }).Date = FixedDate as typeof Date;
  let seed = 1;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // No WebGL, so maps use the Leaflet raster fallback, which renders the same
  // way each time.
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    if (/webgl/i.test(type)) return null;
    return (getContext as (...a: unknown[]) => unknown).call(
      this,
      type,
      ...rest,
    );
  } as typeof getContext;
}

async function storageStateFor(
  browser: Browser,
  baseURL: string,
  user: VisualUser,
  password: string,
) {
  if (user === 'visitor') return undefined;
  const context = await browser.newContext({ baseURL });
  const response = await context.request.post('/api/auth/signin', {
    data: { username: USERNAMES[user], password },
  });
  if (!response.ok()) {
    throw new Error(`Sign-in as ${user} failed: ${response.status()}`);
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

async function openContext(
  run: AppRun,
  side: Side,
  target: Target,
  viewport: Viewport,
  dir: string,
  states: Map<string, Awaited<ReturnType<typeof storageStateFor>>>,
): Promise<BrowserContext> {
  const baseURL = run.urls[side];
  const stateKey = `${side}:${target.user}`;
  if (!states.has(stateKey)) {
    states.set(
      stateKey,
      await storageStateFor(run.browser, baseURL, target.user, run.password),
    );
  }
  const context = await run.browser.newContext({
    ...viewport.options,
    baseURL,
    storageState: states.get(stateKey),
    reducedMotion: 'reduce',
    timezoneId: 'UTC',
    locale: 'en-GB',
  });
  if (dir === 'rtl') {
    await context.addCookies([{ name: 'i18n', value: 'ar', url: baseURL }]);
  }
  await context.addInitScript(initScript, FIXED_NOW);
  const origin = new URL(baseURL).origin;
  await context.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      if (request.resourceType() === 'image') {
        return route.fulfill({ contentType: 'image/png', body: PIXEL });
      }
      return route.abort();
    }
    if (url.pathname.startsWith('/api/')) {
      if (target.holdApi?.test(url.pathname + url.search)) {
        return; // Never answered: the page stays in its loading state.
      }
      if (target.failApi?.test(url.pathname)) {
        return route.fulfill({
          status: request.method() === 'GET' ? 500 : 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Visual check error.' }),
        });
      }
      // Writes would change the shared data between the two sides, such as
      // marking a thread read.
      if (request.method() !== 'GET') {
        return route.fulfill({ contentType: 'application/json', body: '{}' });
      }
    }
    return route.continue();
  });
  return context;
}

async function settle(page: Page, target: Target) {
  if (target.holdApi) {
    await page.waitForTimeout(1500);
  } else {
    await page
      .waitForLoadState('networkidle', { timeout: 15000 })
      .catch(() => {});
  }
  // An unstyled page on both sides would compare as identical.
  const appStylesheets = await page.evaluate(
    () =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link =>
        /\/assets\/react-main(\.rtl)?\.css/.test(
          (link as HTMLLinkElement).href,
        ),
      ).length,
  );
  if (appStylesheets === 0) {
    throw new Error(`${target.path}: the app stylesheet is not linked`);
  }
  await page.addStyleTag({ content: freezeCss });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // The footer's build stamp names the branch and commit, by design.
    for (const stamp of document.querySelectorAll('.site-footer-build')) {
      stamp.textContent = 'build';
    }
    await Promise.all(
      [...document.images]
        .filter(image => !image.complete)
        .map(
          image =>
            new Promise(resolve => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            }),
        ),
    );
  });
  await page.waitForTimeout(250);
}

async function capture(
  run: AppRun,
  side: Side,
  target: Target,
  viewport: Viewport,
  dir: string,
  states: Map<string, Awaited<ReturnType<typeof storageStateFor>>>,
): Promise<{ png: Buffer; styles: StyleSnapshot }> {
  const context = await openContext(run, side, target, viewport, dir, states);
  try {
    const page = await context.newPage();
    await page.goto(target.path, {
      waitUntil: target.holdApi ? 'domcontentloaded' : 'load',
    });
    await settle(page, target);
    if (target.prepare) {
      await target.prepare(page);
      await page.waitForTimeout(250);
    }
    const styles = await snapshotStyles(page);
    const png = target.clip
      ? await page
          .locator(target.clip)
          .first()
          .screenshot({ animations: 'disabled', caret: 'hide' })
      : await page.screenshot({
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
        });
    return { png, styles };
  } finally {
    await context.close();
  }
}

export async function shootApp(run: AppRun) {
  const jobs: { target: Target; viewport: Viewport; dir: string }[] = [];
  for (const target of run.targets) {
    for (const viewport of viewports) {
      for (const dir of directions) {
        const key = `app/${target.name}/${viewport.name}/${dir}`;
        if (!run.only || run.only.test(key))
          jobs.push({ target, viewport, dir });
      }
    }
  }
  const states = new Map<string, Awaited<ReturnType<typeof storageStateFor>>>();
  // Sign in once per side and user before workers start.
  for (const side of ['before', 'after'] as const) {
    for (const user of new Set(jobs.map(job => job.target.user))) {
      states.set(
        `${side}:${user}`,
        await storageStateFor(run.browser, run.urls[side], user, run.password),
      );
    }
  }
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { target, viewport, dir } = jobs[next++];
      const key = `app/${target.name}/${viewport.name}/${dir}`;
      const comparison: Comparison = {
        suite: 'app',
        key,
        name: target.path,
        user: target.user,
        viewport: viewport.name,
        dir,
        pixels: 0,
        styleDifferences: 0,
        styles: [],
        result: 'identical',
        box: null,
      };
      try {
        const shoot = (side: Side) =>
          capture(run, side, target, viewport, dir, states);
        const before = await shoot('before');
        const after = await shoot('after');
        const diff = await run.comparer.compare(before.png, after.png);
        const styles = compareStyles(before.styles, after.styles);
        comparison.pixels = diff.differing;
        comparison.box = diff.box;
        comparison.size = { width: diff.width, height: diff.height };
        comparison.styleDifferences = styles.count;
        comparison.styles = styles.differences;
        const images: Record<string, Buffer> = {
          before: before.png,
          after: after.png,
        };
        if (diff.differing > 0 || styles.count > 0) {
          if (diff.differing > 0) images.diff = diff.png;
          // Re-shoot both sides. The difference is noise only if some head
          // render is byte-identical to some base render.
          const beforeRenders = [before.png];
          const afterRenders = [after.png];
          let matched = false;
          for (let i = 0; i < run.retries && !matched; i++) {
            beforeRenders.push((await shoot('before')).png);
            afterRenders.push((await shoot('after')).png);
            matched = afterRenders.some(a =>
              beforeRenders.some(b => a.equals(b)),
            );
          }
          if (diff.differing === 0) {
            comparison.result = 'styles-only';
          } else if (matched) {
            comparison.result = 'noise';
            const distinct = beforeRenders.filter(
              (png, index) =>
                beforeRenders.findIndex(other => other.equals(png)) === index,
            );
            comparison.note = `A head render matched a base render; base itself rendered ${distinct.length} distinct way(s).`;
          } else {
            comparison.result = 'different';
          }
          if (diff.box) {
            images['before-crop'] = await run.comparer.crop(
              before.png,
              diff.box,
            );
            images['after-crop'] = await run.comparer.crop(after.png, diff.box);
            images['diff-crop'] = await run.comparer.crop(diff.png, diff.box);
          }
        }
        run.save(comparison, images);
      } catch (error) {
        comparison.result = 'error';
        comparison.error = String(error);
        run.save(comparison, {});
        // Without a browser every remaining target would fail the same way.
        if (!run.browser.isConnected()) {
          throw new Error(`Browser closed during ${key}`, { cause: error });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: run.workers }, worker));
}

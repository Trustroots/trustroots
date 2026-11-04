import type { Page } from '@playwright/test';
import { annotateFeature, expect, test } from '../../support/fixtures.mts';

async function stubTracker(page: Page) {
  const scripts: string[] = [];
  const payloads: Array<{ url: string }> = [];
  await page.route('https://1p.trustroots.org/api/send', async route => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ json: {} });
  });
  await page.route('https://1p.trustroots.org/script.js', async route => {
    scripts.push(route.request().url());
    await route.fulfill({
      contentType: 'text/javascript',
      // Match the tracker's first-view lifecycle, including its behaviour
      // when the configured callback has not been installed yet.
      body: `(() => {
        const hookName = document.currentScript.getAttribute('data-before-send');
        let started = false;
        function start() {
          if (started) return;
          started = true;
          const hook = window[hookName];
          const original = { url: location.href, referrer: document.referrer };
          const payload = typeof hook === 'function' ? hook('event', original) : original;
          window.umamiStarted = true;
          if (payload) fetch('https://1p.trustroots.org/api/send', {
            method: 'POST', body: JSON.stringify(payload),
          });
        }
        if (document.readyState === 'complete') start();
        else document.addEventListener('readystatechange', start, true);
      })();`,
    });
  });
  return { scripts, payloads };
}

for (const gpc of [false, true]) {
  test(`analytics waits for the app bundle with GPC ${gpc ? 'on' : 'off'}`, async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signin', [
      'Analytics starts after the app bundle and respects browser preferences.',
    ]);
    await page.addInitScript(value => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { value });
    }, gpc);
    const tracker = await stubTracker(page);
    let release!: () => void;
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    await page.route('**/assets/react-main.js*', async route => {
      await pending;
      await route.continue();
    });
    try {
      await page.goto('/signin?returnTo=fictional-value#section', {
        waitUntil: 'commit',
      });
      await expect(page.locator('#tr-umami-tracker')).toHaveCount(1);
      expect(tracker.scripts).toEqual([]);
      expect(tracker.payloads).toEqual([]);
    } finally {
      release();
    }
    await page.waitForLoadState('load');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { umamiStarted?: boolean }).umamiStarted,
        ),
      )
      .toBe(true);
    expect(tracker.scripts).toHaveLength(1);
    if (gpc) {
      expect(tracker.payloads).toEqual([]);
    } else {
      await expect.poll(() => tracker.payloads).toHaveLength(1);
      expect(tracker.payloads[0].url).toBe(new URL('/signin', page.url()).href);
    }
    await expect(
      page.getByRole('button', { name: 'Login', exact: true }),
    ).toBeVisible();
  });
}

test('analytics stays inactive when the app bundle fails', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'Analytics stays inactive if the app cannot start.',
  ]);
  const tracker = await stubTracker(page);
  await page.route('**/assets/react-main.js*', route => route.abort('failed'));
  await page.goto('/signin?returnTo=fictional-value#section');
  await expect(page.locator('#tr-umami-tracker')).toHaveCount(1);
  expect(tracker.scripts).toEqual([]);
  expect(tracker.payloads).toEqual([]);
});

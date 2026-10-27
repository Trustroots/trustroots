/* global getComputedStyle */
import type { Page } from '@playwright/test';
import {
  annotateFeature,
  expect,
  expectPresent,
  test,
} from '../../support/fixtures.mts';

async function expectDesignTokens(page: Page) {
  await expect(page.locator('.home-how').first()).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('link[href*="/assets/react-main.css"]')
        .evaluate(link => Boolean((link as HTMLLinkElement).sheet)),
    )
    .toBe(true);

  const styles = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const tokens = {
      '--tr-notification-badge-bg': {
        value: root.getPropertyValue('--tr-notification-badge-bg').trim(),
        property: 'backgroundColor',
      },
      '--tr-brand-primary': {
        value: root.getPropertyValue('--tr-brand-primary').trim(),
        property: 'color',
      },
      '--tr-brand-secondary': {
        value: root.getPropertyValue('--tr-brand-secondary').trim(),
        property: 'color',
      },
      '--tr-font-size-base': {
        value: root.getPropertyValue('--tr-font-size-base').trim(),
        property: 'fontSize',
      },
      '--tr-border-radius-base': {
        value: root.getPropertyValue('--tr-border-radius-base').trim(),
        property: 'borderRadius',
      },
    } as const;
    const resolved: Record<string, { value: string; style: string }> = {};

    for (const [name, token] of Object.entries(tokens)) {
      const probe = document.createElement('span');
      probe.style[token.property] = `var(${name})`;
      document.body.append(probe);
      resolved[name] = {
        value: token.value,
        style: getComputedStyle(probe)[token.property],
      };
      probe.remove();
    }
    return resolved;
  });

  expect(styles).toEqual({
    '--tr-notification-badge-bg': {
      value: '#d9534f',
      style: 'rgb(217, 83, 79)',
    },
    '--tr-brand-primary': {
      value: '#12b591',
      style: 'rgb(18, 181, 145)',
    },
    '--tr-brand-secondary': {
      value: '#cd771b',
      style: 'rgb(205, 119, 27)',
    },
    '--tr-font-size-base': { value: '14px', style: '14px' },
    '--tr-border-radius-base': { value: '2px', style: '2px' },
  });
}

test('design tokens resolve on public pages in LTR and RTL', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'public.home', ['Homepage loads for visitors.']);
  expectPresent(baseURL);

  await page.goto('/');
  await expectDesignTokens(page);

  await context.addCookies([{ name: 'i18n', value: 'ar', url: baseURL }]);
  const rtlStylesheet = page.waitForResponse(
    response =>
      new URL(response.url()).pathname === '/assets/react-main.rtl.css',
  );
  await page.goto('/');
  expect((await rtlStylesheet).ok()).toBeTruthy();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect
    .poll(() =>
      page
        .locator('#rtl-style')
        .evaluate(link => Boolean((link as HTMLLinkElement).sheet)),
    )
    .toBe(true);
  await expectDesignTokens(page);
});

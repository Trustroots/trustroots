/* global getComputedStyle */
import type { Page } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@trustroots/ui/Button';
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

async function expectUtilityAndBootstrap(page: Page) {
  const result = await page.evaluate(() => {
    const utility = document.createElement('span');
    utility.className = 'tw:bg-notification';
    // A Bootstrap `.btn` under an owned-Button utility: the utility wins.
    const button = document.createElement('button');
    button.className = 'btn tw:bg-brand-primary';
    document.body.append(utility, button);
    const styles = {
      utility: getComputedStyle(utility).backgroundColor,
      button: getComputedStyle(button).backgroundColor,
      buttonDisplay: getComputedStyle(button).display,
    };
    utility.remove();
    button.remove();
    return styles;
  });
  expect(result).toEqual({
    utility: 'rgb(217, 83, 79)',
    button: 'rgb(18, 181, 145)',
    buttonDisplay: 'inline-block',
  });
}

test('prefixed utilities coexist with Bootstrap in LTR and RTL', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'public.home', ['Homepage loads for visitors.']);
  expectPresent(baseURL);
  await page.goto('/');
  await expectDesignTokens(page);
  await expectUtilityAndBootstrap(page);

  await context.addCookies([{ name: 'i18n', value: 'ar', url: baseURL }]);
  const rtl = page.waitForResponse(
    response =>
      new URL(response.url()).pathname === '/assets/react-main.rtl.css',
  );
  await page.goto('/');
  expect((await rtl).ok()).toBeTruthy();
  await expect
    .poll(() =>
      page
        .locator('#rtl-style')
        .evaluate(link => Boolean((link as HTMLLinkElement).sheet)),
    )
    .toBe(true);
  await expectUtilityAndBootstrap(page);
});

async function expectButtonUtilitiesWin(page: Page) {
  // Bootstrap's reboot sets `button { border-radius: 0 }`; the owned button's
  // radius utility must win, and its disabled utilities must apply.
  const markup = renderToStaticMarkup(
    createElement(Button, { disabled: true }, 'Cascade probe'),
  );
  const styles = await page.evaluate(html => {
    const host = document.createElement('div');
    host.insertAdjacentHTML('beforeend', html);
    document.body.append(host);
    const style = getComputedStyle(host.querySelector('button')!);
    const result = {
      borderRadius: style.borderRadius,
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
    };
    host.remove();
    return result;
  }, markup);
  expect(styles).toEqual({
    borderRadius: '6px',
    pointerEvents: 'none',
    opacity: '0.65',
  });
}

test('owned button utilities override legacy button rules in LTR and RTL', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'public.home', ['Homepage loads for visitors.']);
  expectPresent(baseURL);
  await page.goto('/');
  await expectDesignTokens(page);
  await expectButtonUtilitiesWin(page);

  await context.addCookies([{ name: 'i18n', value: 'ar', url: baseURL }]);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect
    .poll(() =>
      page
        .locator('#rtl-style')
        .evaluate(link => Boolean((link as HTMLLinkElement).sheet)),
    )
    .toBe(true);
  await expectButtonUtilitiesWin(page);
});

test('owned buttons show a contrasting keyboard focus ring on white', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.home', ['Homepage loads for visitors.']);
  await page.goto('/');
  await expectDesignTokens(page);
  // Render the real component so the test follows its Tailwind classes.
  const buttons = (['primary', 'default'] as const)
    .map(colour =>
      renderToStaticMarkup(
        createElement(Button, { colour }, `Focus ${colour}`),
      ),
    )
    .join('');
  await page.evaluate(markup => {
    const host = document.createElement('div');
    host.id = 'button-focus-probe';
    host.tabIndex = -1;
    host.style.backgroundColor = '#fff';
    host.insertAdjacentHTML('beforeend', markup);
    document.body.prepend(host);
    host.focus();
  }, buttons);
  for (const colour of ['primary', 'default']) {
    await page.keyboard.press('Tab');
    const button = page.getByRole('button', {
      name: `Focus ${colour}`,
      exact: true,
    });
    await expect(button).toBeFocused();
    expect(
      await button.evaluate(element => element.matches(':focus-visible')),
    ).toBe(true);
    await expect(button).toHaveCSS('outline-style', 'solid');
    await expect(button).toHaveCSS('outline-width', '2px');
    const colours = await button.evaluate(element => ({
      ring: getComputedStyle(element).outlineColor,
      surface: getComputedStyle(element.parentElement!).backgroundColor,
    }));
    expect(colours.ring).not.toBe(colours.surface);
    expect(colours.ring).not.toBe('rgba(0, 0, 0, 0)');
  }
});

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

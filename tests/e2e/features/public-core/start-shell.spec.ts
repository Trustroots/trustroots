import type { Page } from '@playwright/test';
import { captureSection, expect, test } from '../../support/fixtures.mts';
import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';

function bootstrapUsername(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { user: { username: string } | null }).user
        ?.username ?? null,
  );
}

const mobile = { width: 390, height: 844 };

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function expectNoncedScripts(page: Page) {
  const scripts = await page
    .locator('script')
    .evaluateAll(elements => elements.map(script => Boolean(script.nonce)));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts).not.toContain(false);
}

test.describe('app shell', () => {
  test('visitors get the nonced shell with header, hero and footer', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto('/');
    const header = page.locator('#tr-header');
    const hero = page.locator('.home-intro');
    const footer = page.locator('#tr-footer');
    await expect(hero).toBeVisible();
    await expectNoncedScripts(page);
    expect(await bootstrapUsername(page)).toBeNull();

    await captureSection(header, 'shell-header-desktop');
    await captureSection(hero, 'shell-home-hero-desktop');
    await page.setViewportSize(mobile);
    await expect(hero).toBeVisible();
    await captureSection(header, 'shell-header-mobile');
    await captureSection(hero, 'shell-home-hero-mobile');

    // Phones only show the footer on circle pages.
    await page.goto('/circles/hitchhikers');
    await expect(footer).toBeVisible();
    await expectNoncedScripts(page);
    await captureSection(footer, 'shell-circle-footer-mobile');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/faq');
    await expect(footer).toBeVisible();
    await captureSection(footer, 'shell-footer-desktop');
    expect(errors).toEqual([]);
  });

  test('members get their bootstrap user, search map and profiles', async ({
    page,
  }) => {
    const [member, other] = SEEDED_MEMBERS;
    const errors = collectPageErrors(page);
    await signInViaApi(page, undefined, member!);
    await page.goto('/search');
    const header = page.locator('#tr-header');
    const profileMenu = header.getByRole('button', { name: 'Profile menu' });
    const mobileMenu = header.getByRole('link', {
      name: 'My profile, info and support',
    });
    const map = page.locator('section.search');
    await expect(map).toBeVisible();
    await expectNoncedScripts(page);
    expect(await bootstrapUsername(page)).toBe(member!.username);
    await expect(profileMenu).toBeVisible();
    await expect(mobileMenu).toBeHidden();
    await captureSection(header, 'shell-member-header-desktop');
    await captureSection(map, 'shell-search-map-desktop');

    await page.goto(`/profile/${other!.username}`);
    const profile = page.locator('.profile-view');
    await expect(profile).toBeVisible();
    await captureSection(profile, 'shell-profile-desktop');

    await page.setViewportSize(mobile);
    await expect(profile).toBeVisible();
    await expect(profileMenu).toBeHidden();
    await expect(mobileMenu).toBeVisible();
    await captureSection(header, 'shell-member-header-mobile');
    await captureSection(profile, 'shell-profile-mobile');
    await page.goto('/search');
    await expect(map).toBeVisible();
    await captureSection(map, 'shell-search-map-mobile');
    expect(errors).toEqual([]);
  });

  test('Arabic renders the shell right to left', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'i18n', value: 'ar', url: baseURL }]);
    const errors = collectPageErrors(page);
    await page.goto('/');
    const hero = page.locator('.home-intro');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(hero).toBeVisible();
    await expectNoncedScripts(page);
    await captureSection(
      page.locator('#tr-header'),
      'shell-rtl-header-desktop',
    );
    await captureSection(hero, 'shell-rtl-home-hero-desktop');
    await page.setViewportSize(mobile);
    await expect(hero).toBeVisible();
    await captureSection(page.locator('#tr-header'), 'shell-rtl-header-mobile');
    await captureSection(hero, 'shell-rtl-home-hero-mobile');
    expect(errors).toEqual([]);
  });
});

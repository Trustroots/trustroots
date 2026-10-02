/* global getComputedStyle */
const {
  annotateFeature,
  expect,
  test,
  useViewportScreenshot,
} = require('../../support/test');
const { SEEDED_ADMIN, signInViaApi } = require('../../support/helpers');

async function expectTricon(locator) {
  await expect(locator).toBeVisible();
  const style = await locator.evaluate(icon => {
    const pseudo = getComputedStyle(icon, '::before');
    return { content: pseudo.content, family: pseudo.fontFamily };
  });
  expect(style.family).toContain('tricons');
  expect(style.content).not.toBe('none');
}

async function expectPlaceBordersAligned(place) {
  const input = await place.locator('input[type="text"]').boundingBox();
  const button = await place
    .getByRole('button', { name: 'Clear location search' })
    .boundingBox();

  expect(input).not.toBeNull();
  expect(button).not.toBeNull();
  expect(
    Math.abs(input.y + input.height - button.y - button.height),
  ).toBeLessThan(1);
}

test('home circles have room below the preceding image', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.home', [
    'Home circles have space below the preceding image at desktop and mobile widths.',
  ]);

  await page.goto('/');
  const section = page.locator('.home-how:has(.tribe-image)');
  await expect(section).toBeVisible();
  const desktopSection = await section.boundingBox();
  const desktopCircle = await section
    .locator('.tribe-image:visible')
    .first()
    .boundingBox();
  expect(desktopCircle.y - desktopSection.y).toBeGreaterThanOrEqual(75);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSection = await section.boundingBox();
  const mobileCircle = await section
    .locator('.tribe-xs:visible')
    .first()
    .boundingBox();
  expect(mobileCircle.y - mobileSection.y).toBeGreaterThanOrEqual(75);
});

test('place borders and account checkbox spacing survive Bootstrap 5', async ({
  page,
}, testInfo) => {
  useViewportScreenshot(testInfo);
  annotateFeature(testInfo, 'search.map', [
    'The place search input and clear button share a bottom border at desktop and mobile widths.',
  ]);
  annotateFeature(testInfo, 'account.details-update', [
    'The community newsletter checkbox has space before its label.',
  ]);

  await page.goto('/signin');
  await expectTricon(page.locator('.btn-password-toggle .icon-eye'));

  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/search');
  const desktopPlace = page.locator('.search-sidebar-section .search-place');
  await expect(desktopPlace).toBeVisible();
  await expectPlaceBordersAligned(desktopPlace);
  await expectTricon(
    page.locator('.search-sidebar-tabs .icon-sliders').first(),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/search');
  await expectTricon(page.locator('#tr-header a[href="/search"] .icon-search'));
  await page.getByRole('button', { name: /search places/i }).click();
  const mobilePlace = page.locator('.search-map-place .search-place');
  await expect(mobilePlace).toBeVisible();
  await expectPlaceBordersAligned(mobilePlace);

  await page.goto('/profile/edit/account');
  const accountNavigation = page.locator('.profile-edit-navbar-mobile');
  const navigationBounds = await accountNavigation.boundingBox();
  expect(navigationBounds.height).toBeLessThan(80);
  const accountIcon = accountNavigation.locator('.icon-cog');
  await expectTricon(accountIcon);
  const firstIcon = await accountNavigation
    .locator('li:first-child i')
    .boundingBox();
  const lastIcon = await accountNavigation
    .locator('li:last-child i')
    .boundingBox();
  expect(lastIcon.x).toBeGreaterThan(firstIcon.x);
  const newsletter = page.locator('.profile-newsletter label');
  await expect(newsletter).toBeVisible();
  const checkbox = await newsletter.locator('input').boundingBox();
  const text = await newsletter.locator('span').boundingBox();
  expect(checkbox).not.toBeNull();
  expect(text).not.toBeNull();
  expect(text.x - checkbox.x - checkbox.width).toBeGreaterThanOrEqual(6);
});

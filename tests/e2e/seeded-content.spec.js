const { test, expect } = require('@playwright/test');

const { SEEDED_MEMBERS, waitForTribesList } = require('./helpers');

test.describe('seeded content and public API flows', () => {
  test('languages API returns a non-empty list', async ({ request }) => {
    const response = await request.get('/api/languages?format=array');

    expect(response.ok()).toBeTruthy();

    const languages = await response.json();
    expect(Array.isArray(languages)).toBeTruthy();
    expect(languages.length).toBeGreaterThan(0);
  });

  test('statistics page loads for visitors', async ({ page }) => {
    await page.goto('/statistics');

    await expect(page).toHaveURL(/\/statistics/);
    await expect(page).toHaveTitle(/Statistics - Trustroots/);
  });

  test('seeded host public profile is visible', async ({ page }) => {
    const host = SEEDED_MEMBERS[0];

    await page.goto(`/profile/${host.username}`);

    await expect(page).toHaveURL(new RegExp(`/profile/${host.username}`));
    await expect(
      page.getByText(`${host.firstName} ${host.lastName}`).first(),
    ).toBeVisible();
  });

  test('circle detail page loads for a seeded tribe', async ({ page }) => {
    await page.goto('/circles');
    await waitForTribesList(page);

    await page
      .locator('a.tribe-link', { hasText: 'Hitchhikers' })
      .first()
      .click();

    await expect(page).toHaveURL(/\/circles\/hitchhikers/);
    await expect(
      page.locator('h2.tribe-title', { hasText: 'Hitchhikers' }).first(),
    ).toBeVisible();
  });
});

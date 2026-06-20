const { annotateFeature, test, expect } = require('../../support/test');

const { SEEDED_MEMBERS, waitForTribesList } = require('../../support/helpers');

test.describe('seeded content and public API flows', () => {
  test('languages API returns a non-empty list', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.languages-api', [
      'Languages API returns a non-empty locale list.',
    ]);

    const response = await request.get('/api/languages?format=array');

    expect(response.ok()).toBeTruthy();

    const languages = await response.json();
    expect(Array.isArray(languages)).toBeTruthy();
    expect(languages.length).toBeGreaterThan(0);
  });

  test('statistics page loads for visitors', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'public.statistics', [
      'Statistics page loads for visitors.',
      'Statistics page loads for signed-in members.',
      'Public statistics API returns deterministic data.',
    ]);

    await page.goto('/statistics');

    await expect(page).toHaveURL(/\/statistics/);
    await expect(page).toHaveTitle(/Statistics - Trustroots/);
  });

  test('viewing a host profile while signed out redirects to sign in', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.signed-out-redirect', [
      'Signed-out profile access redirects to sign in.',
      'Redirect preserves enough context to continue after authentication when supported.',
    ]);

    const host = SEEDED_MEMBERS[0];

    await page.goto(`/profile/${host.username}`);

    await expect(page).toHaveURL(/\/signin(\?|$)/);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('circle detail page loads for a seeded tribe', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'circles.detail', [
      'Seeded circle detail page loads.',
      'Unknown circle shows a user-facing error or not found state.',
    ]);

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

  test('tribes API returns seeded circles', async ({ request }, testInfo) => {
    annotateFeature(testInfo, 'circles.list', [
      'Tribes API returns seeded circles.',
    ]);

    const response = await request.get('/api/tribes', {
      params: { limit: 150 },
    });
    expect(response.ok()).toBeTruthy();

    const tribes = await response.json();
    expect(Array.isArray(tribes)).toBeTruthy();
    expect(tribes.length).toBeGreaterThanOrEqual(10);

    const labels = tribes.map(tribe => tribe.label);
    expect(labels).toContain('Hitchhikers');
    expect(labels).toContain('Cyclists');
  });
});

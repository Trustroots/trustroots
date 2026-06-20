const { annotateFeature, expect, test } = require('../../support/test');

const { SEEDED_ADMIN, signInViaApi } = require('../../support/helpers');

test.describe('admin acquisition feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin acquisition story tools return deterministic rows and analysis', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Acquisition stories page loads.',
      'Acquisition stories query returns deterministic rows.',
    ]);
    annotateFeature(testInfo, 'admin.acquisition-analysis', [
      'Acquisition story analysis page loads.',
      'Analysis API returns deterministic analysis.',
    ]);

    await page.goto('/admin/acquisition-stories');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories/);

    const stories = await page.request.post('/api/admin/acquisition-stories');
    expect(stories.ok()).toBeTruthy();
    expect(
      (await stories.json()).some(item =>
        /hitchhiking friends/i.test(item.acquisitionStory),
      ),
    ).toBe(true);

    await page.goto('/admin/acquisition-stories/analysis');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories\/analysis/);

    const analysis = await page.request.post(
      '/api/admin/acquisition-stories/analysis',
    );
    expect(analysis.ok()).toBeTruthy();
    expect(Object.keys(await analysis.json()).length).toBeGreaterThan(0);
  });
});

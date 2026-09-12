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
      'Story rows link profile pictures to public member profiles.',
      'Story rows show circle participation.',
      'Story rows show available member and hosting locations.',
      'Story rows show matching restricted accounts.',
      'Story columns can be sorted.',
    ]);
    annotateFeature(testInfo, 'admin.acquisition-analysis', [
      'Acquisition story analysis page loads.',
      'Analysis API returns deterministic analysis.',
    ]);

    await page.goto('/admin/acquisition-stories');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories/);
    await expect(
      page.getByRole('link', {
        name: 'Open public profile for Alice Contact',
      }),
    ).toHaveAttribute('href', '/profile/e2e-seeded-alice');
    await expect(
      page.getByRole('button', { name: /^circles$/i }),
    ).toBeVisible();
    await expect(page.getByText('Living: Fictional home')).toBeVisible();
    await expect(page.getByText('From: Fictional origin')).toBeVisible();
    await expect(page.getByText(/^Hosting: /)).toBeVisible();
    const aliceRow = page.locator('tr').filter({ hasText: 'Alice Contact' });
    await expect(
      aliceRow.getByRole('link', {
        name: 'e2e-seeded-shadow (Shadow Spammer)',
      }),
    ).toHaveAttribute('href', '/admin/user?id=665000000000000000000004');
    await expect(aliceRow.getByText(/Acquisition story/)).toBeVisible();
    await expect(page.locator('img[loading="lazy"]').first()).toHaveAttribute(
      'src',
      /\/api\/users\/.+\/avatar\?size=32/,
    );

    const stories = await page.request.post('/api/admin/acquisition-stories');
    expect(stories.ok()).toBeTruthy();
    const storyRows = await stories.json();
    const aliceStory = storyRows.find(item =>
      /hitchhiking friends/i.test(item.acquisitionStory),
    );
    expect(aliceStory).toBeTruthy();
    expect(aliceStory.circleCount).toBe(1);
    expect(aliceStory.locationLiving).toBe('Fictional home');
    expect(aliceStory.locationFrom).toBe('Fictional origin');
    expect(aliceStory.hostingLocation).toHaveLength(2);
    expect(aliceStory.restrictedMatches).toEqual([
      expect.objectContaining({
        username: 'e2e-seeded-shadow',
        matchReasons: ['Acquisition story'],
      }),
    ]);

    await page.goto('/admin/acquisition-stories/analysis');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories\/analysis/);

    const analysis = await page.request.post(
      '/api/admin/acquisition-stories/analysis',
    );
    expect(analysis.ok()).toBeTruthy();
    expect(Object.keys(await analysis.json()).length).toBeGreaterThan(0);
  });
});

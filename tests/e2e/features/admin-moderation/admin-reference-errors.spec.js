const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_RELATIONSHIP_MEMBERS,
  signInViaApi,
} = require('../../support/helpers');

test.describe('admin reference and error feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin can query reference threads and user error states', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.reference-threads', [
      'Admin reference threads page loads.',
      'Reference thread API returns deterministic rows.',
    ]);
    annotateFeature(testInfo, 'admin.search-users', [
      'Search handles no-result state.',
    ]);
    annotateFeature(testInfo, 'admin.user-report', [
      'Missing user id shows a usable error state.',
    ]);
    annotateFeature(testInfo, 'admin.threads', [
      'Admin can query threads by username/user id.',
    ]);

    await page.goto('/admin/reference-threads');
    await expect(page).toHaveURL(/\/admin\/reference-threads/);

    const referenceThreads = await page.request.get(
      '/api/admin/reference-threads',
    );
    expect(referenceThreads.ok()).toBeTruthy();
    const referenceThreadsBody = await referenceThreads.json();
    const referenceThreadItems = Array.isArray(referenceThreadsBody)
      ? referenceThreadsBody
      : referenceThreadsBody.items;
    expect(referenceThreadItems.length).toBeGreaterThan(0);

    const noResults = await page.request.post('/api/admin/users', {
      data: { search: 'definitely-no-e2e-user' },
    });
    expect(noResults.ok()).toBeTruthy();
    expect(await noResults.json()).toEqual([]);

    const missingUser = await page.request.post('/api/admin/user', {
      data: { id: '000000000000000000000000' },
    });
    expect(missingUser.status()).toBe(404);

    const threads = await page.request.post('/api/admin/threads', {
      data: { username: SEEDED_RELATIONSHIP_MEMBERS.alice.username },
    });
    expect(threads.ok()).toBeTruthy();
    expect(Array.isArray(await threads.json())).toBeTruthy();
  });
});

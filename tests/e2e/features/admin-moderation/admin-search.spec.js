const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  createIsolatedContext,
  signInViaApi,
} = require('../../support/helpers');

test.describe('admin moderation search flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin search finds a confirmed seeded member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.search-users', [
      'Admin search finds a confirmed member.',
      'Admin search finds a shadowbanned member.',
      'Search handles no-result state.',
    ]);

    const berlin = SEEDED_MEMBERS[0];

    await page.goto('/admin/search-users');

    await page.locator('input[type="search"]').fill(berlin.username);
    const searchResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: /^search$/i }).click();
    await searchResponse;

    await expect(page.getByText(berlin.username).first()).toBeVisible();
    await expect(page.getByText(berlin.email).first()).toBeVisible();
  });

  test('admin search finds the shadowbanned member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.search-users', [
      'Admin search finds a confirmed member.',
      'Admin search finds a shadowbanned member.',
      'Search handles no-result state.',
    ]);

    await page.goto('/admin/search-users');

    await page.locator('input[type="search"]').fill(SEEDED_SHADOW.username);
    const searchResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: /^search$/i }).click();
    await searchResponse;

    const shadowBanRow = page
      .locator('table tbody tr')
      .filter({ hasText: SEEDED_SHADOW.username })
      .first();
    await expect(shadowBanRow).toBeVisible();
    await expect(shadowBanRow.getByText('shadowban')).toBeVisible();
  });

  test('admin can list members in the shadowban role', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.list-users-by-role', [
      'Admin can list members in a selected role.',
      'Role list respects deterministic seeded users.',
    ]);

    await page.goto('/admin/search-users');

    await page.locator('select[name="role"]').selectOption('shadowban');
    const listRoleResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: /list users in role/i }).click();
    await listRoleResponse;

    await expect(page.getByText(SEEDED_SHADOW.username).first()).toBeVisible();
  });

  test('admin search APIs reject invalid input', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.search-users', [
      'Search handles no-result state.',
    ]);
    annotateFeature(testInfo, 'admin.list-users-by-role', [
      'Role list respects deterministic seeded users.',
    ]);

    const shortSearch = await page.request.post('/api/admin/users', {
      data: { search: 'ab' },
    });
    expect(shortSearch.status()).toBe(400);
    expect(await shortSearch.json()).toMatchObject({
      message: 'Query string at least 3 characters long required.',
    });

    const invalidRole = await page.request.post('/api/admin/users/by-role', {
      data: { role: 'not-a-role' },
    });
    expect(invalidRole.status()).toBe(400);
    expect(await invalidRole.json()).toMatchObject({
      message: 'Invalid role.',
    });
  });

  test('admin search APIs reject regular members', async ({
    baseURL,
    browser,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.dashboard', [
      'Regular member is denied access to admin tools.',
    ]);
    annotateFeature(testInfo, 'admin.search-users', [
      'Admin search finds a confirmed member.',
    ]);
    annotateFeature(testInfo, 'admin.list-users-by-role', [
      'Admin can list members in a selected role.',
    ]);

    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, SEEDED_MEMBERS[0]);

      const search = await page.request.post('/api/admin/users', {
        data: { search: SEEDED_MEMBERS[1].username },
      });
      expect(search.status()).toBe(403);

      const byRole = await page.request.post('/api/admin/users/by-role', {
        data: { role: 'shadowban' },
      });
      expect(byRole.status()).toBe(403);
    } finally {
      await context.close();
    }
  });
});

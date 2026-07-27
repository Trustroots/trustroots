const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
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

    await page
      .locator('input[type="search"]')
      .type(`  ${berlin.firstName} ${berlin.lastName}  `);
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

  test('admin can sort member search results by name', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.search-users', [
      'Admin can sort member search results by name.',
    ]);

    await page.goto('/admin/search-users');
    await page.locator('input[type="search"]').fill('e2e-seeded');
    const searchResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: /^search$/i }).click();
    await searchResponse;

    await page.getByRole('button', { name: 'Name', exact: true }).click();

    await expect(page.locator('table tbody tr').first()).toContainText(
      'e2e-seeded-alice',
    );
    await expect(page.locator('table thead th').first()).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  test('admin can inspect members sharing an exact current IP address', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.search-users', [
      'Admin can inspect members sharing an exact current IP address.',
    ]);

    await page.goto('/admin/search-users');
    await page.locator('input[type="search"]').fill(SEEDED_ADMIN.username);
    const searchResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: /^search$/i }).click();
    await searchResponse;

    const resultRow = page
      .locator('table tbody tr')
      .filter({ hasText: SEEDED_ADMIN.username })
      .first();
    const ipLink = resultRow.locator('a[href*="/admin/user?ip="]');
    await expect(ipLink).toBeVisible();
    const matchingMembersResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/users/by-last-ip-address') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await ipLink.click();
    await matchingMembersResponse;

    await expect(page).toHaveURL(/\/admin\/user\?ip=/);
    await expect(
      page.getByRole('link', {
        name: new RegExp(`^${SEEDED_ADMIN.username} \\(`),
      }),
    ).toBeVisible();
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

  test('admin can paginate a role list', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.list-users-by-role', [
      'Admin can paginate a role list.',
    ]);
    const requests = [];
    const makeUser = (id, username) => ({
      _id: id,
      created: '2026-01-01T00:00:00.000Z',
      displayName: `${username} Example`,
      email: `${username}@example.test`,
      roles: ['user', 'volunteer'],
      username,
    });

    await page.route('**/api/admin/users/by-role', async route => {
      const request = route.request().postDataJSON();
      requests.push(request);
      const pageNumber = request.page || 1;
      await route.fulfill({
        contentType: 'application/json',
        json: {
          pagination: {
            page: pageNumber,
            pageSize: 150,
            total: 151,
            totalPages: 2,
          },
          sort: request.sort,
          users:
            pageNumber === 1
              ? [makeUser('111111111111111111111111', 'page-one-member')]
              : [makeUser('222222222222222222222222', 'page-two-member')],
        },
      });
    });

    await page.goto('/admin/search-users');
    await page.locator('select[name="role"]').selectOption('volunteer');
    await page.getByRole('button', { name: /list users in role/i }).click();

    await expect(page.getByText(/page-one-member/).first()).toBeVisible();
    await expect(page.getByText('151 user(s). Page 1 of 2.')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText(/page-two-member/).first()).toBeVisible();
    expect(requests[1]).toMatchObject({
      page: 2,
      role: 'volunteer',
      sort: { column: 'username', direction: 'ascending' },
    });
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

    const invalidIpAddress = await page.request.post(
      '/api/admin/users/by-last-ip-address',
      { data: { ipAddress: 'invalid' } },
    );
    expect(invalidIpAddress.status()).toBe(400);
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
    const context = await browser.newContext({ baseURL });
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

      const byIpAddress = await page.request.post(
        '/api/admin/users/by-last-ip-address',
        { data: { ipAddress: '203.0.113.10' } },
      );
      expect(byIpAddress.status()).toBe(403);
    } finally {
      await context.close();
    }
  });
});

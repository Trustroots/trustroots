const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_MEMBERS,
  SEEDED_ADMIN,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  signInViaApi,
} = require('../../support/helpers');
const { findUserByUsername } = require('../../support/db');

test.describe('admin moderation flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin dashboard welcomes the signed in admin', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.dashboard', [
      'Admin dashboard loads for admin.',
    ]);

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page).toHaveTitle(/Admin - Trustroots/);
    await expect(page.getByText(/welcome, friend!/i)).toBeVisible();
  });

  test('admin audit log page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.audit-log', [
      'Audit log page loads.',
      'Audit log API returns deterministic entries.',
    ]);

    await page.goto('/admin/audit-log');

    await expect(page).toHaveURL(/\/admin\/audit-log/);
    await expect(page).toHaveTitle(/Admin - Audit log - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /audit log/i }),
    ).toBeVisible();
  });

  test('admin threads page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.threads', [
      'Admin threads page loads.',
      'Admin can query threads by username/user id.',
    ]);

    await page.goto('/admin/threads');

    await expect(page).toHaveURL(/\/admin\/threads/);
    await expect(page).toHaveTitle(/Admin - Threads - Trustroots/);
    await expect(page.getByRole('button', { name: /^query$/i })).toBeVisible();
  });

  test('admin newsletter page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Newsletter admin page loads.',
      'Unavailable download actions degrade safely because subscriber APIs are disabled.',
    ]);

    await page.goto('/admin/newsletter');

    await expect(page).toHaveURL(/\/admin\/newsletter/);
    await expect(page).toHaveTitle(/Admin - Newsletter - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /newsletter subscribers/i }),
    ).toBeVisible();
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

  test('admin messages tool shows shadow-hidden messages between members', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'safety.shadowban-hiding', [
      'Shadowbanned profile is hidden from members.',
      'Shadow-hidden messages are not visible to regular recipients.',
      'Admin tools can still inspect shadow-hidden content.',
    ]);

    annotateFeature(testInfo, 'admin.messages', [
      'Admin messages page loads.',
      'Admin can query messages between two users.',
      'Shadow-hidden messages are visible to admin.',
    ]);

    const shadow = await findUserByUsername(SEEDED_SHADOW.username);
    const shadowId = String(shadow._id);
    const berlin = await findUserByUsername('e2e-seeded-berlin');
    const berlinId = String(berlin._id);

    const shadowDisplayName = `${SEEDED_SHADOW.firstName} ${SEEDED_SHADOW.lastName}`;

    await page.goto(`/admin/messages?userId1=${shadowId}&userId2=${berlinId}`);
    const messagesResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/messages') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.locator('input[name="userId1"]').fill(shadowId);
    await page.locator('input[name="userId2"]').fill(berlinId);
    await page.getByRole('button', { name: /^read$/i }).click();
    await messagesResponse;

    await expect(page.getByText(SEEDED_SHADOW_MESSAGE).first()).toBeVisible();
    await expect(
      page.getByText(shadowDisplayName, { exact: false }).first(),
    ).toBeVisible();
  });

  test('admin user report card shows message counts for a shadowbanned member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.user-report', [
      'Admin user report card loads for a member id.',
      'Report card includes role and message counts.',
      'Missing user id shows a usable error state.',
    ]);

    const shadow = await findUserByUsername(SEEDED_SHADOW.username);
    const shadowId = String(shadow._id);

    await page.goto(`/admin/user?id=${shadowId}`);

    await expect(
      page.getByRole('heading', {
        name: `${SEEDED_SHADOW.firstName} ${SEEDED_SHADOW.lastName} report card`,
      }),
    ).toBeVisible();
    await expect(page.getByText('shadowban').first()).toBeVisible();
    await expect(page.getByText('1 sent').first()).toBeVisible();
  });
});

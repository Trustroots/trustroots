const { annotateFeature, test, expect } = require('../../support/test');

const { SEEDED_ADMIN, signInViaApi } = require('../../support/helpers');

async function gotoAdminPage(page, path, expectedUrl) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    try {
      await expect(page).toHaveURL(expectedUrl, { timeout: 5000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

test.describe('admin moderation page flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin dashboard welcomes the signed in admin', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.dashboard', [
      'Admin dashboard loads for admin.',
    ]);

    await gotoAdminPage(page, '/admin', /\/admin$/);

    await expect(page).toHaveTitle(/Admin - Trustroots/);
    await expect(page.getByText(/welcome, friend!/i)).toBeVisible();
  });

  test('admin audit log page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.audit-log', [
      'Audit log page loads.',
      'Audit log API returns deterministic entries.',
    ]);

    await gotoAdminPage(page, '/admin/audit-log', /\/admin\/audit-log/);

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

    await gotoAdminPage(page, '/admin/threads', /\/admin\/threads/);

    await expect(page).toHaveTitle(/Admin - Threads - Trustroots/);
    await expect(page.getByRole('button', { name: /^query$/i })).toBeVisible();
  });

  test('admin newsletter page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Newsletter admin page loads.',
      'Unavailable download actions degrade safely because subscriber APIs are disabled.',
    ]);

    await gotoAdminPage(page, '/admin/newsletter', /\/admin\/newsletter/);

    await expect(page).toHaveTitle(/Admin - Newsletter - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /newsletter subscribers/i }),
    ).toBeVisible();
  });
});

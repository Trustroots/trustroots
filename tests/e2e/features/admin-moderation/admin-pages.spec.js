const {
  annotateFeature,
  test,
  expect,
  useElementScreenshot,
} = require('../../support/test');

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
    useElementScreenshot(testInfo, '#tr-footer');
    annotateFeature(testInfo, 'admin.dashboard', [
      'Admin dashboard loads for admin.',
      'Admin footer uses the shared footer layout.',
    ]);

    await gotoAdminPage(page, '/admin', /\/admin$/);

    await expect(page).toHaveTitle(/Admin - Trustroots/);
    await expect(
      page.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeVisible();
    await expect(page.getByLabel('Name, username or email')).toBeVisible();

    const footer = page.locator('#tr-footer');
    await expect(footer).toBeVisible();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.locator('.site-footer-content')).toBeVisible();
    await expect(footer.locator('.site-footer-meta')).toBeVisible();

    for (const [name, href] of [
      ['Volunteering', 'https://team.trustroots.org/'],
      ['Rules', '/rules'],
      ['FAQ', '/faq'],
      ['Privacy', '/privacy'],
      ['Contact', '/contact'],
    ]) {
      await expect(footer.getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      );
    }
    await expect(
      footer.getByRole('link', { name: 'Trustroots Foundation' }),
    ).toHaveCount(0);

    const contentBox = await footer
      .locator('.site-footer-content')
      .boundingBox();
    const metaBox = await footer.locator('.site-footer-meta').boundingBox();
    expect(contentBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    expect(metaBox.x + metaBox.width).toBeGreaterThan(
      contentBox.x + contentBox.width - 1,
    );
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

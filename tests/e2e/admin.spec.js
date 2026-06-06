const { test, expect } = require('./test');

const {
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  fetchUserIdByUsername,
} = require('./helpers');

test.describe('admin moderation flows', () => {
  test('admin dashboard welcomes the signed in admin', async ({ page }) => {
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page).toHaveTitle(/Admin - Trustroots/);
    await expect(page.getByText(/welcome, friend!/i)).toBeVisible();
  });

  test('admin audit log page loads', async ({ page }) => {
    await page.goto('/admin/audit-log');

    await expect(page).toHaveURL(/\/admin\/audit-log/);
    await expect(page).toHaveTitle(/Admin - Audit log - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /audit log/i }),
    ).toBeVisible();
  });

  test('admin threads page loads', async ({ page }) => {
    await page.goto('/admin/threads');

    await expect(page).toHaveURL(/\/admin\/threads/);
    await expect(page).toHaveTitle(/Admin - Threads - Trustroots/);
    await expect(page.getByRole('button', { name: /^query$/i })).toBeVisible();
  });

  test('admin newsletter page loads', async ({ page }) => {
    await page.goto('/admin/newsletter');

    await expect(page).toHaveURL(/\/admin\/newsletter/);
    await expect(page).toHaveTitle(/Admin - Newsletter - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /newsletter subscribers/i }),
    ).toBeVisible();
  });

  test('admin search finds a confirmed seeded member', async ({ page }) => {
    const berlin = SEEDED_MEMBERS[0];

    await page.goto('/admin/search-users');

    await page.locator('input[type="search"]').fill(berlin.username);
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText(berlin.username).first()).toBeVisible();
    await expect(page.getByText(berlin.email).first()).toBeVisible();
  });

  test('admin search finds the shadowbanned member', async ({ page }) => {
    await page.goto('/admin/search-users');

    await page.locator('input[type="search"]').fill(SEEDED_SHADOW.username);
    await page.getByRole('button', { name: /^search$/i }).click();

    await expect(page.getByText(SEEDED_SHADOW.username).first()).toBeVisible();
    await expect(page.getByText('shadowban').first()).toBeVisible();
  });

  test('admin can list members in the shadowban role', async ({ page }) => {
    await page.goto('/admin/search-users');

    await page.locator('select[name="role"]').selectOption('shadowban');
    await page.getByRole('button', { name: /list users in role/i }).click();

    await expect(page.getByText(SEEDED_SHADOW.username).first()).toBeVisible();
  });

  test('admin messages tool shows shadow-hidden messages between members', async ({
    page,
    request,
  }) => {
    const shadowId = await fetchUserIdByUsername(
      request,
      SEEDED_SHADOW.username,
    );
    const berlinId = await fetchUserIdByUsername(request, 'e2e-seeded-berlin');

    await page.goto('/admin/messages');
    await page.locator('input[name="userId1"]').fill(shadowId);
    await page.locator('input[name="userId2"]').fill(berlinId);
    await page.getByRole('button', { name: /^read$/i }).click();

    await expect(page.getByText(SEEDED_SHADOW_MESSAGE).first()).toBeVisible();
    await expect(page.getByText(SEEDED_SHADOW.username).first()).toBeVisible();
  });

  test('admin user report card shows message counts for a shadowbanned member', async ({
    page,
    request,
  }) => {
    const shadowId = await fetchUserIdByUsername(
      request,
      SEEDED_SHADOW.username,
    );

    await page.goto(`/admin/user?id=${shadowId}`);

    await expect(page.getByText(/report card/i)).toBeVisible();
    await expect(page.getByText('shadowban').first()).toBeVisible();
    await expect(page.getByText('1 sent').first()).toBeVisible();
  });
});

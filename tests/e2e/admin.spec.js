const { test, expect } = require('@playwright/test');

const {
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  fetchUserIdByUsername,
} = require('./helpers');

test.describe('admin moderation flows', () => {
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

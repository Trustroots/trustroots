const { expect, test } = require('../../support/test');
const { SEEDED_MEMBERS } = require('../../support/helpers');

test('recovery prefill submits through the existing API', async ({ page }) => {
  await page.goto(`/password/forgot?userhandle=${SEEDED_MEMBERS[0].username}`);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.getByLabel('Email or username')).toHaveValue(
    SEEDED_MEMBERS[0].username,
  );
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(
    page.getByText('We sent you an email with further instructions.'),
  ).toBeVisible();
});

test('outcome pages retain their onward links', async ({ page }) => {
  await page.goto('/password/reset/invalid');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await page
    .getByRole('link', { name: /ask for a new password reset/i })
    .click();
  await expect(page).toHaveURL(/\/password\/forgot$/);
  await page.goto('/password/reset/success');
  await expect(page.getByText('Password successfully reset')).toBeVisible();
  await page.goto('/confirm-email-invalid');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await page.getByRole('link', { name: /login first/i }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(1);
});

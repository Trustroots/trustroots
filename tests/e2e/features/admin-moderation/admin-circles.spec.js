const { annotateFeature, expect, test } = require('../../support/test');

const { SEEDED_ADMIN, signInViaApi } = require('../../support/helpers');

test.describe('admin circles feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin can create and edit a circle', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.circles', [
      'Admin circles page loads.',
      'Admin can create a circle.',
      'Admin can edit an existing circle.',
    ]);

    const label = `E2E Circle ${Date.now()}`;
    await page.goto('/admin/circles');
    await expect(page.getByRole('heading', { name: 'Circles' })).toBeVisible();
    await page.getByRole('button', { name: 'New circle' }).click();
    await page.getByLabel('Name').fill(label);
    await page.getByLabel('Public').uncheck();
    const saved = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/circles') &&
        ['POST', 'PUT'].includes(response.request().method()),
    );
    await page.getByRole('button', { name: 'Save circle' }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByText('Circle saved.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: new RegExp(label) }),
    ).toBeVisible();

    await page.getByRole('button', { name: new RegExp(label) }).click();
    await page
      .getByLabel('Description')
      .fill('Edited by the administration test.');
    await page.getByRole('button', { name: 'Save circle' }).click();
    await expect(page.getByText('Circle saved.')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.getByLabel('Description')).toHaveValue(
      'Edited by the administration test.',
    );
    await expect(page.getByLabel('Public')).not.toBeChecked();
  });
});

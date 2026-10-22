import { annotateFeature, expect, test } from '../../support/fixtures.mts';

import { SEEDED_ADMIN, signInViaApi } from '../../support/helpers.mts';

test.describe('admin circles feature coverage', () => {
  test('admin can compare circles and sort catalogue columns', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.circles', [
      'Circle catalogue shows thumbnails and descriptions and sorts each data column.',
    ]);
    await page.route('**/api/admin/circles', route =>
      route.fulfill({
        json: [
          {
            _id: 'alpine',
            slug: 'alpine',
            label: 'Alpine Walkers',
            count: 12,
            public: true,
            image: true,
            description: 'Woodland walks',
          },
          {
            _id: 'books',
            slug: 'books',
            label: 'Book Club',
            count: 3,
            public: false,
            description: 'Shared reading',
          },
        ],
      }),
    );
    await page.route('**/uploads-circle/alpine/120x120.jpg', route =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#065f46"/></svg>',
      }),
    );
    await page.goto('/admin/circles');
    const table = page.getByRole('table', { name: 'Circles' });
    await expect(table.getByText('Woodland walks')).toBeVisible();
    await expect(table.getByText('12', { exact: true })).toBeVisible();
    await expect(table.getByText('12 members')).toHaveCount(0);
    await expect(table.locator('img')).toBeVisible();
    await table.getByRole('button', { name: 'Alpine Walkers' }).click();
    for (const heading of ['Name', 'Description', 'Members']) {
      const column = table.getByRole('columnheader', {
        name: heading,
        exact: true,
      });
      await column.getByRole('button').click();
      await expect(column).toHaveAttribute(
        'aria-sort',
        heading === 'Name' ? 'descending' : 'ascending',
      );
      await column.getByRole('button').click();
      await expect(column).toHaveAttribute(
        'aria-sort',
        heading === 'Name' ? 'ascending' : 'descending',
      );
    }
    await expect(table.getByRole('row').nth(1)).toContainText('Alpine Walkers');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
      'Alpine Walkers',
    );
    await expect(
      table.getByRole('button', { name: 'Alpine Walkers' }),
    ).toHaveCSS('text-align', 'left');
    await page.screenshot({
      path: testInfo.outputPath('circle-table-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page
        .locator('html')
        .evaluate(element => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('circle-table-mobile.png'),
      fullPage: true,
    });
  });

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
    await expect(
      page
        .locator('.admin-circles-page')
        .getByRole('heading', { name: 'Circles' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'New circle' }).click();
    await page.getByLabel('Name', { exact: true }).fill(label);
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

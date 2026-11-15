import sharp from 'sharp';

import { annotateFeature, expect, test } from '../../support/fixtures.mts';

import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';

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

  test('admin can add and remove organisers on an existing circle', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.circles', [
      'Admins can edit organisers on an existing circle.',
      'Signed-in viewers see organiser profile links even when the organiser has not joined the circle.',
      'Guests do not see organisers.',
    ]);
    const [organiser, viewer] = SEEDED_MEMBERS;
    const created = await request.post('/api/admin/circles', {
      data: { label: `Example organisers ${Date.now()}`, public: true },
    });
    expect(created.status()).toBe(201);
    const { slug, label } = await created.json();
    const editPath = `/admin/circles/${slug}`;
    const circlePath = `/circles/${slug}`;

    await page.goto(editPath);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(label);
    await page.getByLabel('Organiser username').fill(organiser.username);
    await page.getByRole('button', { name: 'Add organiser' }).click();
    const remove = page.getByRole('button', { name: /^Remove / });
    await expect(remove).toBeVisible();
    await page.locator('#circle-image').setInputFiles({
      name: 'circle.png',
      mimeType: 'image/png',
      buffer: await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#123456' },
      })
        .png()
        .toBuffer(),
    });
    await page.getByRole('button', { name: 'Save circle' }).click();
    await expect(
      page.getByText('Circle saved.', { exact: true }),
    ).toBeVisible();

    await signInViaApi(page, request, viewer);
    await page.goto(circlePath);
    const section = page.getByRole('region', { name: 'Circle organisers' });
    await expect(section.getByRole('link')).toHaveAttribute(
      'href',
      `/profile/${organiser.username}`,
    );
    await page.context().clearCookies();
    await page.goto(circlePath);
    await expect(
      page.getByRole('heading', { name: /^Example organisers / }),
    ).toBeVisible();
    await expect(section).toHaveCount(0);

    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto(editPath);
    await remove.click();
    await page.getByRole('button', { name: 'Save circle' }).click();
    await expect(
      page.getByText('Circle saved.', { exact: true }),
    ).toBeVisible();
    await page.goto(circlePath);
    await expect(
      page.getByRole('heading', { name: /^Example organisers / }),
    ).toBeVisible();
    await expect(section).toHaveCount(0);
  });

  test('admin can create and edit a circle', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.circles', [
      'Admin circles page loads.',
      'Admin can create a circle.',
      'Admin can edit an existing circle.',
      'Admin circle selection follows a reloadable, navigable slug URL.',
      'Circle descriptions preview and display safe clickable links.',
      'Admins can move between public circle pages and circle editing.',
    ]);

    const label = `E2E Circle ${Date.now()}`;
    const description =
      'Read <a href="https://example.test/circle-info" onclick="alert(1)">the circle guide</a>. <a href="javascript:alert(1)">unsafe link</a>';
    const persistedDescription =
      'Read <a href="https://example.test/circle-info">the circle guide</a>. ';
    const circleSlug = label.toLowerCase().replaceAll(' ', '-');
    const smallPng = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: '#123456',
      },
    })
      .png()
      .toBuffer();
    await page.goto('/admin/circles');
    await expect(
      page
        .locator('.admin-circles-page')
        .getByRole('heading', { name: 'Circles' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'New circle' }).click();
    await page.getByLabel('Name', { exact: true }).fill(label);
    await page.locator('#circle-description').fill(description);
    await page.getByRole('checkbox', { name: 'Public', exact: true }).check();
    const preview = page.getByRole('region', { name: 'Description preview' });
    await expect(
      preview.getByRole('link', { name: 'the circle guide' }),
    ).toHaveAttribute('href', 'https://example.test/circle-info');
    await expect(
      preview.getByRole('link', { name: 'unsafe link' }),
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('circle-description-preview.png'),
      fullPage: true,
    });
    await page.locator('#circle-image').setInputFiles({
      name: 'circle.png',
      mimeType: 'image/png',
      buffer: smallPng,
    });
    const saved = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/circles') &&
        ['POST', 'PUT'].includes(response.request().method()),
    );
    await page.getByRole('button', { name: 'Save circle' }).click();
    const saveResponse = await saved;
    expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`/admin/circles/${circleSlug}$`));
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(label);
    await expect(
      page.getByRole('button', { name: new RegExp(label) }),
    ).toBeVisible();
    await expect(page.getByAltText('Current circle')).toBeVisible();

    // Loading the slug directly selects the same circle. Selection changes
    // browser history and restores the selected form on back/forward.
    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(label);
    await expect(page.locator('#circle-description')).toHaveValue(
      persistedDescription,
    );
    await expect(
      page
        .getByRole('region', { name: 'Description preview' })
        .getByRole('link', { name: 'the circle guide' }),
    ).toHaveAttribute('href', 'https://example.test/circle-info');
    await page.goto('/admin/circles');
    await page.getByRole('button', { name: new RegExp(label) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/circles/${circleSlug}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/circles$/);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/admin/circles/${circleSlug}$`));
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(label);

    await page.getByRole('link', { name: 'View circle' }).click();
    await expect(page).toHaveURL(new RegExp(`/circles/${circleSlug}$`));
    await expect(
      page.getByRole('link', { name: 'the circle guide' }),
    ).toHaveAttribute('href', 'https://example.test/circle-info');
    await expect(page.getByRole('link', { name: 'unsafe link' })).toHaveCount(
      0,
    );
    await page.getByRole('link', { name: 'Edit circle' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/circles/${circleSlug}$`));

    await signInViaApi(page, page.request, SEEDED_MEMBERS[0]);
    await page.goto(`/circles/${circleSlug}`);
    await expect(page.getByRole('link', { name: 'Edit circle' })).toHaveCount(
      0,
    );
    await expect(page.getByText('the circle guide')).toBeVisible();

    await signInViaApi(page, page.request, SEEDED_ADMIN);
    await page.goto(`/admin/circles/${circleSlug}`);
    await expect(page.locator('#circle-description')).toHaveValue(
      persistedDescription,
    );
    await page
      .locator('#circle-description')
      .fill('Edited by the administration test.');
    await page.getByRole('button', { name: 'Save circle' }).click();
    await expect(page.getByText('Circle saved.')).toBeVisible();
    await page.reload();
    await expect(page.locator('#circle-description')).toHaveValue(
      'Edited by the administration test.',
    );
    await expect(
      page.getByRole('checkbox', { name: 'Public', exact: true }),
    ).toBeChecked();
  });
});

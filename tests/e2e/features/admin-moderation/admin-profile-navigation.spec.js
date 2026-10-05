const { annotateFeature, expect, test } = require('../../support/fixtures');
const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  createIsolatedContext,
  signInViaApi,
} = require('../../support/helpers');

test('profile actions align and expose admin records only to administrators', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.user-report', [
    'Administrator profile actions link to the viewed member record.',
    'Exact username admin links load the same member record without paginated search.',
    'Ordinary members do not see profile admin actions.',
    'Administrators see a header shortcut before Circles; other members do not.',
  ]);
  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, SEEDED_ADMIN);
  await page.goto(`/profile/${member.username}`);
  const primary = page.locator('.nav-header-primary');
  await expect(
    primary.getByRole('link', { name: 'Admin', exact: true }),
  ).toHaveAttribute('href', '/admin');
  const primaryLinks = primary.locator(':scope > li > a');
  await expect(primaryLinks.nth(0)).toHaveText('Admin');
  await expect(primaryLinks.nth(1)).toHaveText('Circles');
  const actions = page.locator('.profile-actions');
  const admin = actions.getByRole('link', { name: 'Admin', exact: true });
  await expect(admin).toHaveAttribute('href', `/admin/user?id=${member.id}`);
  const links = await actions.locator('a').all();
  const boxes = await Promise.all(links.map(link => link.boundingBox()));
  expect(boxes.every(box => box !== null)).toBeTruthy();
  const centres = boxes.map(box => box.y + box.height / 2);
  expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(1);
  await admin.click();
  await expect(page).toHaveURL(new RegExp(`/admin/user\\?id=${member.id}$`));
  await expect(
    page.getByRole('link', { name: 'Public profile', exact: true }),
  ).toHaveAttribute('href', `/profile/${member.username}`);
  let usernameSearchRequested = false;
  await page.route('**/api/admin/users', async route => {
    usernameSearchRequested = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pagination: { page: 1, pageSize: 150, total: 0, totalPages: 0 },
        sort: { column: 'username', direction: 'ascending' },
        users: [],
      }),
    });
  });
  await page.goto(`/admin/user/${member.username}`);
  await expect(
    page.getByRole('link', { name: 'Public profile', exact: true }),
  ).toHaveAttribute('href', `/profile/${member.username}`);
  expect(usernameSearchRequested).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/profile/${member.username}`);
  await expect(
    page
      .locator('.visible-xs-block')
      .getByRole('link', { name: 'Admin', exact: true }),
  ).toHaveAttribute('href', `/admin/user?id=${member.id}`);
  const context = await createIsolatedContext(browser, baseURL);
  try {
    const memberPage = await context.newPage();
    await signInViaApi(memberPage, context.request, SEEDED_MEMBERS[1]);
    await memberPage.goto(`/profile/${member.username}`);
    await expect(
      memberPage.getByRole('heading', {
        name: `@${member.username}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      memberPage.getByRole('link', { name: 'Admin', exact: true }),
    ).toHaveCount(0);
    await memberPage.goto(`/admin/user/${member.username}`);
    await expect(memberPage).toHaveURL(/\/volunteering$/);
  } finally {
    await context.close();
  }
});

const { annotateFeature, test, expect } = require('../../support/test');
const { SEEDED_MEMBERS, signInViaApi } = require('../../support/helpers');

test('profile viewing tabs load through the React shell', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'profile.view-about', [
    'Own profile about tab loads.',
  ]);
  annotateFeature(testInfo, 'profile.view-contacts', [
    'Own contacts tab can show empty state.',
  ]);

  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, member);

  for (const suffix of ['', '/contacts', '/experiences']) {
    await page.goto(`/profile/${member.username}${suffix}`);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(page.locator('.profile-view')).toBeVisible();
  }
});

test('switching profile tabs keeps the loaded profile visible', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'profile.view-about', [
    'Switching profile tabs keeps the loaded profile visible.',
  ]);
  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, member);
  await page.goto(`/profile/${member.username}`);
  await expect(page.locator('.profile-tabs')).toBeVisible();

  let profileRequests = 0;
  page.on('request', outgoing => {
    if (outgoing.url().includes(`/api/users/${member.username}`)) {
      profileRequests += 1;
    }
  });

  await page.getByRole('tab', { name: /contacts/i }).click();
  await expect(page).toHaveURL(`/profile/${member.username}/contacts`);
  await expect(page.locator('.profile-tabs')).toBeVisible();
  await page.getByRole('tab', { name: /about/i }).click();
  await expect(page).toHaveURL(`/profile/${member.username}`);
  await expect(page.locator('.profile-tabs')).toBeVisible();
  expect(profileRequests).toBe(0);
});

test('mobile profile navigation stays compact and readable', async ({
  page,
  request,
}) => {
  const member = SEEDED_MEMBERS[0];
  await page.setViewportSize({ width: 390, height: 844 });
  await signInViaApi(page, request, member);
  await page.goto(`/profile/${member.username}/overview`);

  const bottomNavigation = page.locator('.profile-view-navbar-mobile');
  await expect(bottomNavigation).toBeVisible();
  const tabs = bottomNavigation.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  const tabBounds = await tabs.evaluateAll(links =>
    links.map(link => link.getBoundingClientRect().toJSON()),
  );
  expect(Math.max(...tabBounds.map(bounds => bounds.y))).toBeLessThanOrEqual(
    Math.min(...tabBounds.map(bounds => bounds.y)) + 1,
  );
  const bottomBounds = await bottomNavigation.boundingBox();
  expect(bottomBounds.height).toBeLessThanOrEqual(60);
  for (const tab of await tabs.all()) {
    await expect(tab).toHaveCSS('color', 'rgb(255, 255, 255)');
  }

  const headerLinks = page.locator(
    '#tr-header .nav-header-primary > li:visible > a',
  );
  await expect(headerLinks).toHaveCount(4);
  const headerBounds = await headerLinks.evaluateAll(links =>
    links.map(link => link.getBoundingClientRect().toJSON()),
  );
  const widths = headerBounds.map(bounds => bounds.width);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  expect(headerBounds[0].x).toBeLessThan(40);
  expect(headerBounds[3].right).toBeGreaterThan(350);
});

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

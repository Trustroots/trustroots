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

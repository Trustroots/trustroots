const { annotateFeature, expect, test } = require('../../support/test');
const { SEEDED_MEMBERS, signInViaApi } = require('../../support/helpers');

test('member entry pages require sign-in', async ({ page }, testInfo) => {
  annotateFeature(testInfo, 'member.entry', [
    'Guest entry routes redirect to sign-in.',
  ]);
  for (const path of [
    '/welcome',
    '/navigation',
    '/search/members?search=sample',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin(?:\?|$)/);
  }
});

test('welcome and navigation preserve member workflows and sign-out', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'member.entry', [
    'Welcome and navigation use the React shell.',
    'Profile editing still uses its existing workflow.',
    'Signing out ends the authenticated session.',
  ]);
  await signInViaApi(page, undefined, SEEDED_MEMBERS[0]);
  await page.goto('/welcome');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Hey, welcome!' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Fill your profile' }).click();
  await expect(page).toHaveURL(/\/profile\/edit$/);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
  await page.goto('/navigation');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
  await page
    .locator('#tr-main')
    .getByRole('link', { name: 'Find people' })
    .click();
  await expect(page).toHaveURL(/\/search\/members$/);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await page.goto('/navigation');
  await page
    .locator('#tr-main')
    .getByRole('link', { name: 'Sign out' })
    .click();
  await page.goto('/navigation');
  await expect(page).toHaveURL(/\/signin(?:\?|$)/);
});

test('member search supports deep links, empty results and profile navigation', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'search.members', [
    'Query links populate the member search and its results.',
    'Empty results and profile navigation remain available.',
  ]);
  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, undefined, member);
  await page.goto(
    `/search/members?search=${encodeURIComponent(member.username)}`,
  );
  await expect(page.locator('#tr-react-root')).toBeVisible();
  const search = page.getByRole('textbox', {
    name: 'Search members',
    exact: true,
  });
  await expect(search).toHaveValue(member.username);
  await page
    .locator(`#tr-main h4 a[href="/profile/${member.username}"]`)
    .click();
  await expect(page).toHaveURL(new RegExp(`/profile/${member.username}$`));
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
  await page.goto('/search/members');
  await search.fill('sample-no-matching-member-57291');
  await page
    .getByRole('button', { name: 'Search members', exact: true })
    .click();
  await expect(page.getByText('No members found by this name.')).toBeVisible();
});

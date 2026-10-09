const { test, expect } = require('../../support/fixtures');
const {
  SEEDED_MEMBERS,
  createIsolatedContext,
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  updateUserByUsername,
  removeUserByUsername,
} = require('../../support/db');

test('greeter badge opens the team page and empty chats name the recipient', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const member = createUser({ firstName: 'Robin', lastName: 'Example' });
  const setup = await createIsolatedContext(browser, baseURL);
  try {
    await registerViaApi(setup.request, member);
  } finally {
    await setup.close();
  }
  try {
    await updateUserByUsername(member.username, {
      $set: { public: true, roles: ['user', 'volunteer', 'welcome-team'] },
    });
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    await page.goto(`/profile/${member.username}`);
    await expect(
      page.getByRole('link', { name: 'Trustroots volunteer', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'Trustroots greeter', exact: true })
      .click();
    await expect(page).toHaveURL(/\/team\/greeters$/);
    await expect(
      page.getByRole('link', { name: 'Want to join?', exact: true }),
    ).toHaveAttribute('href', '/support?category=volunteering');
    await page.goto(`/messages/${member.username}`);
    await expect(
      page.getByRole('heading', {
        name: "You haven't been talking with Robin Example yet.",
      }),
    ).toBeVisible();
    await updateUserByUsername(member.username, { $set: { roles: ['user'] } });
    await page.goto(`/profile/${member.username}`);
    await expect(page.locator('.profile-view')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Trustroots greeter', exact: true }),
    ).toHaveCount(0);
  } finally {
    await removeUserByUsername(member.username);
  }
});

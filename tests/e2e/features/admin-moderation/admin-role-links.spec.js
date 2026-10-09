const { annotateFeature, expect, test } = require('../../support/fixtures');
const {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  removeUserByUsername,
  updateUserByUsername,
} = require('../../support/db');

test('admin role links open a shareable member list', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.list-users-by-role', [
    'Admin can list members in a selected role.',
  ]);
  const member = createUser();
  await registerViaApi(request, member);
  try {
    await updateUserByUsername(member.username, {
      $addToSet: { roles: 'volunteer' },
    });
    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto(`/admin/user/${member.username}`);
    const roleLink = page.getByRole('link', { name: 'volunteer', exact: true });
    await expect(roleLink).toHaveAttribute(
      'href',
      '/admin/search-users?role=volunteer',
    );
    await roleLink.click();
    await expect(page).toHaveURL('/admin/search-users?role=volunteer');
    await expect(page.locator('select[name="role"]')).toHaveValue('volunteer');
    await page.reload();
    await expect(page.locator('select[name="role"]')).toHaveValue('volunteer');
  } finally {
    await removeUserByUsername(member.username);
  }
});

test('greeter menu links directly to acquisition stories', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.acquisition-stories', [
    'Greeters can open acquisition stories from the main menu.',
  ]);
  const member = createUser();
  await registerViaApi(request, member);
  try {
    await updateUserByUsername(member.username, {
      $addToSet: { roles: 'welcome-team' },
    });
    member.roles = ['user', 'welcome-team'];
    await signInViaApi(page, request, member);
    await page.goto('/circles');
    const adminLink = page.getByRole('link', { name: 'Admin', exact: true });
    await expect(adminLink).toHaveAttribute(
      'href',
      '/admin/acquisition-stories',
    );
    await adminLink.click();
    await expect(page).toHaveURL('/admin/acquisition-stories');
    await expect(
      page.getByRole('heading', { name: 'Acquisition stories', exact: true }),
    ).toBeVisible();
  } finally {
    await removeUserByUsername(member.username);
  }
});

import {
  annotateFeature,
  captureSection,
  expect,
  test,
} from '../../support/fixtures.mts';
import {
  authenticateViaApi,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { updateUserByUsername } from '../../support/db.mts';

test('suspended members are signed out and shown the suspended page', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.suspended-member', [
    'Suspended members opening a page are sent to the suspended page.',
    'Suspended members calling the API get a 403 with the suspension message.',
  ]);
  const member = createUser();
  await registerViaApi(request, member);
  await signInViaApi(page, undefined, member);
  await authenticateViaApi(request, member);
  await updateUserByUsername(member.username, {
    $addToSet: { roles: 'suspended' },
  });

  const api = await request.get(`/api/users/${member.username}`, {
    headers: { Accept: 'application/json' },
  });
  expect(api.status()).toBe(403);
  expect(await api.json()).toEqual({
    message: 'Your account has been suspended.',
  });

  await page.goto('/profile/edit');
  await expect(page).toHaveURL(/\/suspended$/);
  const notice = page.getByRole('alert');
  await expect(
    notice.getByRole('heading', { name: 'Your account has been suspended.' }),
  ).toBeVisible();
  await expect(
    notice.getByRole('link', { name: 'Rules Of Trustroots' }),
  ).toHaveAttribute('href', '/rules');
  await expect(
    notice.getByRole('link', { name: 'Contact us' }),
  ).toHaveAttribute('href', '/contact');
  await captureSection(notice, 'suspended-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await captureSection(notice, 'suspended-mobile');

  await page.goto('/profile/edit');
  await expect(page).toHaveURL(/\/signin/);
});

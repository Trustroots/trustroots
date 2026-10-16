import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername } from '../../support/db.mts';

test('administrator can inspect a member without changing their account', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.user-report', [
    'Administrators can enter and exit an audited read-only member view.',
    'Member writes and stale contexts are rejected by the API.',
    'Browsing does not change member activity or IP data.',
  ]);
  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, SEEDED_ADMIN);
  const otherTab = await page.context().newPage();
  await otherTab.goto('/messages');
  const before = (await findUserByUsername(member.username))!;
  await page.goto(`/admin/user/${member.username}`);
  await page.getByRole('button', { name: 'View as this member' }).click();
  await page
    .getByLabel('Your password', { exact: true })
    .fill(SEEDED_ADMIN.password);
  await page
    .getByLabel('Investigation reason')
    .fill('Reproduce a member display problem');
  await page.getByRole('button', { name: 'Open read-only view' }).click();
  await expect(page).toHaveURL(new RegExp(`/profile/${member.username}$`));
  await expect(
    page.getByRole('complementary', { name: 'Member view' }),
  ).toContainText(`Viewing as ${member.username}`);
  const context = await (await page.request.get('/api/auth/session')).json();
  expect(context.userId).toBe(member.id);
  await expect(
    otherTab.getByRole('complementary', { name: 'Member view' }),
  ).toBeVisible();
  const headers = { 'X-Trustroots-View': context.viewGeneration };
  const changed = await page.request.put('/api/users', {
    headers,
    data: { description: 'Unwanted edit' },
  });
  expect(changed.status()).toBe(403);
  const unreadBefore = await (
    await page.request.get('/api/messages-count', { headers })
  ).json();
  await page.goto('/messages');
  await expect(
    page.getByRole('complementary', { name: 'Member view' }),
  ).toBeVisible();
  const unreadAfter = await (
    await page.request.get('/api/messages-count', { headers })
  ).json();
  expect(unreadAfter).toEqual(unreadBefore);
  const after = (await findUserByUsername(member.username))!;
  expect(after.seen).toEqual(before.seen);
  expect(after.lastIpAddress).toEqual(before.lastIpAddress);
  expect(after.description).toEqual(before.description);
  await page.getByRole('button', { name: 'Return to your account' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/user/${member.username}$`));
  await expect(
    page.getByRole('complementary', { name: 'Member view' }),
  ).toHaveCount(0);
  const stale = await page.request.put('/api/users', {
    headers,
    data: { description: 'Unwanted edit' },
  });
  expect(stale.status()).toBe(409);
  await expect(
    otherTab.getByRole('complementary', { name: 'Member view' }),
  ).toHaveCount(0);
  await otherTab.close();
});

import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  createUser,
  createIsolatedContext,
  registerViaApi,
  SEEDED_ADMIN,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername, withE2eDb } from '../../support/db.mts';

test('administrators can suspend, review and unsuspend a member who can sign in again', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.unsuspend-member', [
    'Administrators can confirm unsuspension with a reason and refresh the report.',
    'Audit history records the administrator, member, reason, timestamp and outcome.',
    'Unsuspended members can sign in again with other account settings preserved.',
  ]);
  const member = createUser({ firstName: 'Fictional', lastName: 'Member' });
  await registerViaApi(request, member);
  const memberDoc = (await findUserByUsername(member.username))!;
  await signInViaApi(page, request, SEEDED_ADMIN);
  await page.goto(`/admin/user/${member.username}`);
  await expect(
    page.getByRole('button', { name: 'Unsuspend', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Suspend', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Unsuspend', exact: true }),
  ).toBeVisible();

  const context = await createIsolatedContext(browser, baseURL);
  try {
    const denied = await context.request.post('/api/auth/signin', {
      data: { username: member.username, password: member.password },
    });
    expect(denied.status()).toBe(403);
    await page.getByRole('button', { name: 'Unsuspend', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName(`Unsuspend ${member.username}?`);
    await expect(
      dialog.getByRole('button', { name: 'Confirm unsuspension' }),
    ).toBeDisabled();
    const reason = 'Fictional suspension reviewed and resolved.';
    await dialog.getByLabel('Administrator reason').fill(reason);
    await expect(dialog).toHaveCSS('opacity', '1');
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath('unsuspend-confirmation.png'),
      fullPage: true,
    });
    await dialog.getByRole('button', { name: 'Confirm unsuspension' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Unsuspend', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Suspend', exact: true }),
    ).toBeEnabled();
    const restored = (await findUserByUsername(member.username))!;
    expect(restored.roles).toEqual(['user']);
    expect(restored.public).toBe(false);
    expect(restored.newsletter).toBe(false);
    const audit = await withE2eDb(db =>
      db.collection('auditlogs').findOne({
        route: '/api/admin/user/unsuspend',
        'body.id': String(memberDoc._id),
        'body.outcome': 'unsuspended',
      }),
    );
    expect(audit).not.toBeNull();
    expect(audit!.body.reason).toBe(reason);
    expect(audit!.body.username).toBe(member.username);
    expect(audit!.date).toBeInstanceOf(Date);
    const administrator = (await findUserByUsername(SEEDED_ADMIN.username))!;
    expect(String(audit!.user)).toBe(String(administrator._id));
    const memberPage = await context.newPage();
    await signInViaApi(memberPage, context.request, member);
    await memberPage.goto('/profile/edit');
    await expect(memberPage.getByText(/describe yourself/i)).toBeVisible();
  } finally {
    await context.close();
  }
});

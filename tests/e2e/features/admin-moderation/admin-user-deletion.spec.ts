import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  createUser,
  registerViaApi,
  SEEDED_ADMIN,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername, withE2eDb } from '../../support/db.mts';

test('admins can delete a suspended member after confirming the username', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.user-deletion', [
    'Administrators can permanently delete a suspended member after confirming their username and recording a reason.',
    'Deleted members can no longer sign in.',
  ]);

  const member = createUser();
  await registerViaApi(request, member);
  const memberDoc = (await findUserByUsername(member.username))!;
  const fixtureId = memberDoc._id;

  try {
    await signInViaApi(page, request, SEEDED_ADMIN);
    const suspension = await request.post('/api/admin/user/change-role', {
      data: { id: String(fixtureId), role: 'suspended' },
    });
    expect(suspension.status()).toBe(200);

    await page.goto(`/admin/user?id=${fixtureId}`);
    await page.getByRole('button', { name: 'Delete member' }).click();

    await expect(
      page.getByText('Delete member?', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Confirm username').fill(member.username);
    await page.getByLabel('Reason').fill('Fictional E2E deletion reason.');
    await page.getByLabel('Audit keywords').fill('fictional, e2e-check');
    await page.getByRole('button', { name: 'Delete permanently' }).click();

    await expect(page.getByText(/deleted/i)).toBeVisible();
    expect(await findUserByUsername(member.username)).toBeNull();

    const deletionAudit = await withE2eDb(db =>
      db.collection('auditlogs').findOne({
        route: '/api/admin/user/delete',
        'body.id': String(fixtureId),
      }),
    );
    expect(deletionAudit).not.toBeNull();
    expect((deletionAudit?.body as { reason?: string }).reason).toBe(
      'Fictional E2E deletion reason.',
    );
    expect((deletionAudit?.body as { keywords?: string[] }).keywords).toEqual([
      'fictional',
      'e2e-check',
    ]);

    const deniedLogin = await request.post('/api/auth/signin', {
      data: { username: member.username, password: member.password },
    });
    expect(deniedLogin.ok()).toBeFalsy();
  } finally {
    await withE2eDb(db => db.collection('users').deleteOne({ _id: fixtureId }));
  }
});

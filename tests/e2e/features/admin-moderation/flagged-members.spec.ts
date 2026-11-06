import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  createUser,
  createIsolatedContext,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('support can flag, find and unflag members without changing their access', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.flagged-members', [
    'Support can flag and unflag members in internal profile views.',
    'Support can find flagged members in a paginated list.',
    'Flags grant no permissions and remain hidden from member-facing data.',
  ]);
  const staff = createUser({ firstName: 'Fictional', lastName: 'Support' });
  const member = createUser({ firstName: 'Fictional', lastName: 'Member' });
  await registerViaApi(request, staff);
  const registered = await registerViaApi(request, member);
  await withE2eDb(async db => {
    await db
      .collection('users')
      .updateOne(
        { username: staff.username },
        { $set: { roles: ['user', 'support-team'] } },
      );
    await db
      .collection('users')
      .updateOne(
        { username: member.username },
        { $set: { public: true, emailTemporary: '' } },
      );
  });
  await signInViaApi(page, request, staff);
  await page.goto(`/admin/support/member/${member.username}`);
  await page
    .getByRole('button', { name: 'Flag for follow-up', exact: true })
    .click();
  await expect(
    page.getByText('Flagged for follow-up', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Flagged for follow-up', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('flagged-support-profile.png'),
    fullPage: true,
  });
  await page
    .getByRole('link', { name: 'Flagged members', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/support\/flagged$/);
  const table = page.getByRole('table', { name: 'Flagged members' });
  await expect(
    table.getByRole('link', { name: `${member.username} (Fictional Member)` }),
  ).toBeVisible();

  const context = await createIsolatedContext(browser, baseURL);
  try {
    const ownPage = await context.newPage();
    await signInViaApi(ownPage, context.request, member);
    const shell = await context.request.get('/');
    expect(await shell.text()).not.toContain('"flagged"');
    const profile = await context.request.get(`/api/users/${member.username}`);
    expect(profile.ok()).toBeTruthy();
    expect(await profile.json()).not.toHaveProperty('roles');
    const edit = await context.request.put('/api/users', {
      data: { tagline: 'A fictional profile note' },
    });
    expect(edit.ok()).toBeTruthy();
    const listDenied = await context.request.get(
      '/api/admin/support-flagged-members',
    );
    expect(listDenied.status()).toBe(403);
    const changeDenied = await context.request.patch(
      `/api/admin/support-members/${registered._id}/flag`,
      { data: { flagged: false } },
    );
    expect(changeDenied.status()).toBe(403);
    await ownPage.goto(`/profile/${member.username}`);
    await expect(
      ownPage.getByText('Flagged for follow-up', { exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }

  await table
    .getByRole('link', { name: `${member.username} (Fictional Member)` })
    .click();
  await page.getByRole('button', { name: 'Remove flag', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Flag for follow-up', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Flagged for follow-up', { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Flagged members', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: `${member.username} (Fictional Member)` }),
  ).toHaveCount(0);
});

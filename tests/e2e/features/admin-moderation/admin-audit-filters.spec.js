const { ObjectId } = require('mongodb');
const { annotateFeature, expect, test } = require('../../support/fixtures');
const { SEEDED_ADMIN, signInViaApi } = require('../../support/helpers');
const { withE2eDb } = require('../../support/db');

test('audit history has compact summaries and staff/team filters', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.audit-log', [
    'Audit history summarises requests with raw details collapsed.',
    'Actor and team filters select matching staff activity.',
  ]);
  const actorId = new ObjectId();
  const entryId = new ObjectId();
  const username = `welcome${Date.now()}`;
  try {
    await withE2eDb(async db => {
      await db.collection('users').insertOne({
        _id: actorId,
        username,
        displayName: 'Fictional Welcomer',
        roles: ['user', 'welcome-team'],
      });
      await db.collection('auditlogs').insertOne({
        _id: entryId,
        user: actorId,
        date: new Date(),
        route: '/api/admin/acquisition-stories',
        ip: '203.0.113.10',
        body: { userId: '', username: 'fictionalrecipient' },
        params: {},
        query: { page: 1, limit: 20 },
      });
    });
    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto('/admin/audit-log');
    await expect(
      page.getByRole('option', { name: username, exact: true }),
    ).toHaveCount(1);
    await page.getByLabel('Performed by').selectOption(username);
    const rows = page.locator('.admin-audit-log-table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.locator('.admin-audit-log-summary')).toHaveText(
      'username: fictionalrecipient',
    );
    await expect(rows.locator('details')).not.toHaveAttribute('open', '');
    await rows.getByText('Show details', { exact: true }).click();
    await expect(rows.getByText(/"page": 1/)).toBeVisible();
    await page.getByLabel('Team').selectOption('admin');
    await expect(
      page.getByText('Nothing found...', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Team').selectOption('welcome-team');
    await expect(rows).toHaveCount(1);
    await expect(
      rows.getByRole('link', { name: `${username} (Fictional Welcomer)` }),
    ).toHaveAttribute('href', `/admin/user/${username}`);
    const filtered = await request.get(
      `/api/admin/audit-log?username=${username}&team=welcome-team`,
    );
    expect(filtered.ok()).toBeTruthy();
    expect((await filtered.json()).map(entry => entry._id)).toEqual([
      String(entryId),
    ]);
    await page.getByLabel('Performed by').selectOption('');
    await page.getByLabel('Team').selectOption('admin');
    await expect(
      page
        .getByRole('link', { name: SEEDED_ADMIN.username, exact: false })
        .first(),
    ).toBeVisible();
  } finally {
    await withE2eDb(async db => {
      await db.collection('auditlogs').deleteOne({ _id: entryId });
      await db.collection('users').deleteOne({ _id: actorId });
    });
  }
});

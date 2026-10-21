import { ObjectId } from 'mongodb';
import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import { SEEDED_ADMIN, signInViaApi } from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('administrators can review recorded username changes', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.username-changes', [
    'The admin username history shows recorded previous and new names.',
    'All-time history includes changes older than 90 days.',
  ]);

  const userId = new ObjectId();
  const currentUsername = `history${Date.now()}`;
  const recent = new Date(Date.now() - 60_000);
  const older = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  try {
    await withE2eDb(async db => {
      await db.collection('users').insertOne({
        _id: userId,
        username: currentUsername,
        displayName: 'History Member',
        usernameHistory: [
          {
            oldUsername: 'recent-former-name',
            newUsername: currentUsername,
            changedAt: recent,
          },
          {
            oldUsername: 'older-former-name',
            newUsername: 'middle-name',
            changedAt: older,
          },
        ],
      });
    });

    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto('/admin/username-changes');
    const table = page.getByRole('table', { name: 'Username changes' });
    await expect(table).toContainText('recent-former-name');
    await expect(table).toContainText(currentUsername);
    await expect(table).not.toContainText('older-former-name');
    await expect(
      table.getByRole('link', {
        name: `${currentUsername} (History Member)`,
      }),
    ).toHaveAttribute('href', `/admin/user/${currentUsername}`);
    await expect(table).toContainText(
      `${recent.getUTCFullYear()}-${String(recent.getUTCMonth() + 1).padStart(2, '0')}-${String(recent.getUTCDate()).padStart(2, '0')} ${String(recent.getUTCHours()).padStart(2, '0')}:${String(recent.getUTCMinutes()).padStart(2, '0')}`,
    );

    await page.getByLabel('Date range').selectOption('all');
    await expect(table).toContainText('older-former-name');
    await page.screenshot({
      path: testInfo.outputPath('admin-username-changes.png'),
      fullPage: true,
    });
  } finally {
    await withE2eDb(async db => {
      await db.collection('users').deleteOne({ _id: userId });
    });
  }
});

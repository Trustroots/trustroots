import { annotateFeature, test, expect } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername, withE2eDb } from '../../support/db.mts';

test('admin member statistics distinguish published, unpublished and removed experiences', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.user-report', [
    'Member statistics show received and written experiences with separate unpublished counts.',
    'Removed experiences are excluded and activity cards fit mobile screens.',
  ]);
  const fixtures = Array.from({ length: 6 }, () => createUser());
  for (const user of fixtures) await registerViaApi(request, user);
  const members = await Promise.all(
    fixtures.map(user =>
      findUserByUsername(user.username).then(member => member!),
    ),
  );
  const member = members[0];
  const ids = members.map(user => user._id);
  try {
    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto(`/admin/user/${member.username}`);
    const received = page.getByRole('region', { name: 'Experiences received' });
    const written = page.getByRole('region', { name: 'Experiences written' });
    await expect(received.getByText('0 total', { exact: true })).toBeVisible();
    await expect(written.getByText('0 total', { exact: true })).toBeVisible();
    await withE2eDb(db =>
      db.collection('experiences').insertMany([
        ...[
          { public: true, recommend: 'yes' },
          { public: true, recommend: 'no' },
          { public: true, recommend: 'unknown' },
          { public: false, recommend: 'no' },
          { public: true, recommend: 'no', removedAt: new Date() },
        ].map((category, index) => ({
          userFrom: members[index + 1]._id,
          userTo: member._id,
          created: new Date(),
          ...category,
        })),
        {
          userFrom: member._id,
          userTo: members[1]._id,
          created: new Date(),
          public: true,
          recommend: 'yes',
        },
        {
          userFrom: member._id,
          userTo: members[2]._id,
          created: new Date(),
          public: false,
          recommend: 'no',
        },
      ]),
    );
    await page.reload();
    for (const label of [
      '4 total',
      '1 positive',
      '1 negative',
      '1 neutral',
      '1 unpublished',
    ]) {
      await expect(received.getByText(label, { exact: true })).toBeVisible();
    }
    for (const label of [
      '2 total',
      '1 positive',
      '0 negative',
      '0 neutral',
      '1 unpublished',
    ]) {
      await expect(written.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole('region', { name: 'Stats' }).getByRole('region'),
    ).toHaveCount(6);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const reportWidth = await page.locator('.admin-user-page').boundingBox();
    expect(reportWidth!.width).toBeGreaterThan(1500);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(received).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await withE2eDb(async db => {
      await db.collection('experiences').deleteMany({
        $or: [{ userFrom: member._id }, { userTo: member._id }],
      });
      await db.collection('users').deleteMany({ _id: { $in: ids } });
    });
  }
});

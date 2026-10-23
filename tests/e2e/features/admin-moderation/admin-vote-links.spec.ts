import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername, withE2eDb } from '../../support/db.mts';

test('member vote counts open threads filtered by direction and sentiment', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.threads', [
    'All four member vote counts open the corresponding threads and the filter survives reload.',
  ]);
  const fixtures = Array.from({ length: 5 }, () => createUser());
  for (const fixture of fixtures) await registerViaApi(request, fixture);
  const members = await Promise.all(
    fixtures.map(
      async fixture => (await findUserByUsername(fixture.username))!,
    ),
  );
  const [member, ...others] = members;
  const cases = [
    { direction: 'received', sentiment: 'positive', reference: 'yes' },
    { direction: 'received', sentiment: 'negative', reference: 'no' },
    { direction: 'given', sentiment: 'positive', reference: 'yes' },
    { direction: 'given', sentiment: 'negative', reference: 'no' },
  ];
  const pair = { $or: [{ userFrom: member._id }, { userTo: member._id }] };
  try {
    await withE2eDb(async db => {
      for (const [index, category] of cases.entries()) {
        const other = others[index];
        const { insertedId } = await db.collection('threads').insertOne({
          // Alternate the last message direction independently of the vote.
          userFrom: index % 2 ? other._id : member._id,
          userTo: index % 2 ? member._id : other._id,
          updated: new Date(),
          read: true,
        });
        await db.collection('referencethreads').insertOne({
          thread: insertedId,
          userFrom: category.direction === 'given' ? member._id : other._id,
          userTo: category.direction === 'given' ? other._id : member._id,
          reference: category.reference,
          created: new Date(),
        });
      }
    });
    await signInViaApi(page, request, SEEDED_ADMIN);
    for (const [index, category] of cases.entries()) {
      await page.goto(`/admin/user/${member.username}`);
      const card = page.getByRole('region', {
        name: `Thread votes ${category.direction}`,
      });
      await card.getByRole('link', { name: `1 ${category.sentiment}` }).click();
      const filter = `${category.direction}-${category.sentiment}`;
      await expect(page).toHaveURL(new RegExp(`vote=${filter}`));
      await expect(page.getByLabel('Filter by thread vote')).toHaveValue(
        filter,
      );
      const table = page.getByRole('table', { name: 'Threads' });
      await expect(table.getByRole('row')).toHaveCount(2);
      await expect(
        table.getByRole('link', { name: new RegExp(others[index].username) }),
      ).toBeVisible();
      await page.reload();
      await expect(table.getByRole('row')).toHaveCount(2);
      await page.getByLabel('Filter by thread vote').selectOption('');
      await expect(table.getByRole('row')).toHaveCount(5);
    }
  } finally {
    await withE2eDb(async db => {
      await db.collection('referencethreads').deleteMany(pair);
      await db.collection('threads').deleteMany(pair);
      await db
        .collection('users')
        .deleteMany({ _id: { $in: members.map(item => item._id) } });
    });
  }
});

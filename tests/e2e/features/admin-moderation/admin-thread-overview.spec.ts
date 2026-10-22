import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('thread overview uses usernames, actual message dates and attributed votes', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.threads', [
    'Username navigation, readable thread table, votes and exact first and last message times.',
  ]);
  const [from, to] = SEEDED_MEMBERS;
  const fixture = await withE2eDb(async db => {
    const first = await db
      .collection('users')
      .findOne({ username: from.username });
    const second = await db
      .collection('users')
      .findOne({ username: to.username });
    const pair = { userFrom: first!._id, userTo: second!._id };
    await db.collection('messages').insertMany([
      {
        ...pair,
        created: new Date('2026-01-01T08:09:10Z'),
        content: 'Fictional first message',
      },
      {
        userFrom: second!._id,
        userTo: first!._id,
        created: new Date('2027-01-01T18:30:45Z'),
        content: 'Fictional latest reply',
      },
    ]);
    const thread = await db.collection('threads').findOneAndUpdate(
      { $or: [pair, { userFrom: second!._id, userTo: first!._id }] },
      {
        $set: {
          ...pair,
          read: false,
          updated: new Date('2027-01-01T18:30:45Z'),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    await db.collection('referencethreads').insertOne({
      thread: thread!._id,
      userFrom: second!._id,
      userTo: first!._id,
      reference: 'no',
      created: new Date(),
    });
    return { id: first!._id.toString() };
  });
  await signInViaApi(page, request, SEEDED_ADMIN);
  await page.goto(`/admin/threads?userId=${fixture.id}`);
  await expect(page).toHaveURL(
    new RegExp(`/admin/threads\\?username=${from.username}$`),
  );
  const table = page.getByRole('table', { name: 'Threads' });
  const row = table
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: new RegExp(to.username) }) })
    .first();
  await expect(row.getByText('2026-01-01 08:09')).toBeVisible();
  await expect(row.getByText('2027-01-01 18:30')).toBeVisible();
  await expect(
    row.getByText('negative', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Member username or ID' }),
  ).toHaveCount(0);
  await expect(page.getByText('Thread details', { exact: true })).toHaveCount(
    0,
  );
  await expect(row.getByRole('link', { name: 'Read thread' })).toHaveAttribute(
    'href',
    `/admin/messages?username1=${from.username}&username2=${to.username}`,
  );
  await page.screenshot({
    path: testInfo.outputPath('thread-table.png'),
    fullPage: true,
  });
  await row.getByRole('link', { name: 'Read thread' }).click();
  await expect(page.getByText('Fictional first message')).toBeVisible();
  await expect(page.getByText('Fictional latest reply')).toBeVisible();
});

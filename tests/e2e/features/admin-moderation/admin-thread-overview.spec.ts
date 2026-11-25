import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername, withE2eDb } from '../../support/db.mts';

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
      created: new Date('2027-01-02T03:04:05Z'),
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
  const vote = row
    .getByRole('listitem')
    .filter({ hasText: '2027-01-02 03:04' });
  await expect(vote.getByText('−', { exact: true })).toBeVisible();
  await expect(vote.getByText('2027-01-02 03:04')).toHaveAttribute(
    'datetime',
    '2027-01-02T03:04:05.000Z',
  );
  await expect(page.getByText('Times in UTC.')).toBeVisible();
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

test('admin thread sort toggles by keyboard and preserves the active filters', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.threads', [
    'Keyboard sorting with an accessible sort direction and retained filters.',
  ]);
  const fixtures = Array.from({ length: 3 }, () => createUser());
  for (const fixture of fixtures) await registerViaApi(request, fixture);
  const [member, earlier, later] = await Promise.all(
    fixtures.map(
      async fixture => (await findUserByUsername(fixture.username))!,
    ),
  );
  try {
    await withE2eDb(async db => {
      for (const [index, other] of [earlier, later].entries()) {
        const pair = { userFrom: member._id, userTo: other._id };
        const created = new Date(Date.UTC(2026, 0, index + 1, 10));
        const { insertedId } = await db.collection('threads').insertOne({
          ...pair,
          updated: created,
          read: true,
        });
        await db.collection('messages').insertOne({
          ...pair,
          created,
          content: 'Fictional sorting fixture',
        });
        await db.collection('referencethreads').insertOne({
          ...pair,
          thread: insertedId,
          reference: 'yes',
          created,
        });
      }
    });

    await signInViaApi(page, request, SEEDED_ADMIN);
    const path = `/admin/threads?username=${member.username}&vote=given-positive`;
    await page.goto(path);
    const table = page.getByRole('table', { name: 'Threads' });
    const recipients = table
      .getByRole('row')
      .filter({ has: page.getByRole('cell') });
    const header = table.getByRole('columnheader', { name: 'Last message' });
    const sortByLastMessage = header.getByRole('button', {
      name: 'Last message',
    });
    await expect(recipients).toHaveCount(2);
    await expect(recipients.first()).toContainText(later.username);
    await sortByLastMessage.focus();
    await page.keyboard.press('Enter');
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await expect(recipients.first()).toContainText(earlier.username);
    await page.keyboard.press('Space');
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await expect(recipients.first()).toContainText(later.username);
    await expect(page).toHaveURL(path);
    await expect(page.getByLabel('Filter by thread vote')).toHaveValue(
      'given-positive',
    );
  } finally {
    await withE2eDb(async db => {
      for (const collection of ['referencethreads', 'messages', 'threads']) {
        await db.collection(collection).deleteMany({ userFrom: member._id });
      }
      await db.collection('users').deleteMany({
        _id: { $in: [member._id, earlier._id, later._id] },
      });
    });
  }
});

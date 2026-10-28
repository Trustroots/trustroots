import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  createIsolatedContext,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';
test('administrators review historical spam accounts and explicitly delete only eligible accounts', async ({
  browser,
  baseURL,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.spam-cleanup', [
    'Administrators explicitly delete reviewed eligible spam accounts while protected accounts remain.',
  ]);
  const context = await createIsolatedContext(browser, baseURL);
  const page = await context.newPage();
  const administrator = createUser({
    firstName: 'Fictional',
    lastName: 'Administrator',
  });
  try {
    await registerViaApi(context.request, administrator);
    await signInViaApi(page, context.request, administrator);
    expect(
      (
        await context.request.post('/api/admin/spam-cleanup/preview', {
          data: {},
        })
      ).status(),
    ).toBe(403);
    await withE2eDb(async db => {
      await db
        .collection('users')
        .updateOne(
          { username: administrator.username },
          { $set: { roles: ['user', 'admin'] } },
        );
      const eligible = await db.collection('users').insertOne({
        username: 'fictional-campaign-account',
        email: 'fictional-campaign@example.test',
        created: new Date('2021-07-04T12:00:00Z'),
        roles: ['user', 'suspended'],
        public: false,
      });
      await db.collection('users').insertOne({
        username: 'fictional-retained-choice',
        email: 'fictional-retained-choice@example.test',
        created: new Date('2021-07-04T12:00:00Z'),
        roles: ['user', 'suspended'],
        public: false,
      });
      const protectedUser = await db.collection('users').insertOne({
        username: 'fictional-protected-account',
        email: 'fictional-protected@example.test',
        created: new Date('2021-07-04T12:00:00Z'),
        roles: ['user', 'suspended'],
        public: false,
      });
      await db.collection('adminnotes').insertOne({
        user: protectedUser.insertedId,
        note: 'Fictional moderation record',
      });
      expect(eligible.insertedId).toBeTruthy();
    });
    await signInViaApi(page, context.request, administrator);
    await page.goto('/admin/spam-cleanup');
    await expect(
      page.getByRole('heading', { name: 'Spam account cleanup' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Preview all accounts' }).click();
    await expect(
      page.getByRole('link', { name: 'fictional-campaign-account' }),
    ).toBeVisible();
    await expect(
      page.getByText('Protected or no longer available — retained'),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Select all eligible accounts' })
      .click();
    await page
      .getByRole('checkbox', { name: 'Select fictional-retained-choice' })
      .uncheck();
    const remove = page.getByRole('button', {
      name: 'Delete 1 selected accounts',
    });
    await expect(remove).toBeDisabled();
    await page
      .getByRole('checkbox', {
        name: 'I reviewed this selection and understand deletion is permanent.',
      })
      .check();
    await remove.click();
    await expect(page.getByText(/Deleted 1; skipped 0/)).toBeVisible();
    await withE2eDb(async db => {
      expect(
        await db
          .collection('users')
          .countDocuments({ username: 'fictional-campaign-account' }),
      ).toBe(0);
      expect(
        await db
          .collection('users')
          .countDocuments({ username: 'fictional-retained-choice' }),
      ).toBe(1);
      expect(
        await db
          .collection('users')
          .countDocuments({ username: 'fictional-protected-account' }),
      ).toBe(1);
    });
  } finally {
    await context.close();
  }
});

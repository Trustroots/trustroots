import { ObjectId } from 'mongodb';
import {
  annotateFeature,
  captureSection,
  expect,
  test,
} from '../../support/fixtures.mts';
import {
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { updateUserByUsername, withE2eDb } from '../../support/db.mts';

test('authors can see their own private Experiences and publication countdowns', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.profile-list', [
    'Only the author sees the pending authored list and publication countdowns.',
  ]);
  const [author, pendingRecipient, publicRecipient] = await Promise.all(
    Array.from({ length: 3 }, async () => {
      const user = createUser();
      const { _id } = await registerViaApi(request, user);
      await updateUserByUsername(user.username, {
        $set: { public: true, description: 'A public profile for this test.' },
        $unset: { emailTemporary: 1, emailToken: 1 },
      });
      return { ...user, id: new ObjectId(_id) };
    }),
  );
  const privateFeedback = 'I left an account of our walk.';
  const commonFields = {
    userFrom: author.id,
    created: new Date(),
    interactions: { met: true, host: false, guest: false },
    recommend: 'yes',
  };
  await withE2eDb(db =>
    db.collection('experiences').insertMany([
      {
        ...commonFields,
        userTo: pendingRecipient.id,
        public: false,
        feedbackPublic: privateFeedback,
      },
      {
        ...commonFields,
        userTo: publicRecipient.id,
        public: true,
        feedbackPublic: 'My published account.',
      },
    ]),
  );

  const profile = `/profile/${author.username}/experiences`;
  await signInViaApi(page, request, author);
  await page.goto(profile);
  const pending = page.getByRole('region', {
    name: 'Experiences you shared that are still private',
  });
  await expect(pending.getByText(privateFeedback)).toBeVisible();
  await expect(
    pending.getByText(/your experience will become public/i),
  ).toBeVisible();
  await expect(
    pending.getByRole('link', { name: new RegExp(pendingRecipient.username) }),
  ).toBeVisible();
  await expect(page.getByText('My published account.')).toHaveCount(0);
  await captureSection(pending, 'profile-pending-authored-experiences');

  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  await page.goto(profile);
  await expect(page.getByText('No experiences yet.')).toBeVisible();
  await expect(pending).toHaveCount(0);
  await expect(page.getByText(privateFeedback)).toHaveCount(0);
  const denied = await request.get('/api/experiences', {
    params: { userTo: String(author.id), view: 'pending-authored' },
  });
  expect(denied.status()).toBe(404);
});

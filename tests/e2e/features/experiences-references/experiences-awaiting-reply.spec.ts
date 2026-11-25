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

test('only the profile owner sees received Experiences awaiting a reply together', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.profile-list', [
    'The profile owner can find pending and public Experiences awaiting a reply.',
  ]);

  const [
    owner,
    pendingAuthor,
    publicAuthor,
    answeredAuthor,
    removedReplyAuthor,
  ] = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const user = createUser();
      const { _id } = await registerViaApi(request, user);
      await updateUserByUsername(user.username, {
        $set: {
          public: true,
          description: 'A public profile for this test.',
        },
        $unset: { emailTemporary: 1, emailToken: 1 },
      });
      return { ...user, id: new ObjectId(_id) };
    }),
  );

  const experiences = [
    {
      userFrom: pendingAuthor.id,
      userTo: owner.id,
      public: false,
      feedbackPublic: 'Feedback pending publication.',
    },
    {
      userFrom: publicAuthor.id,
      userTo: owner.id,
      public: true,
      feedbackPublic: 'We had a picnic by the river.',
      interactions: { met: true, host: true, guest: false },
    },
    {
      userFrom: answeredAuthor.id,
      userTo: owner.id,
      public: true,
      feedbackPublic: 'We visited the market together.',
    },
    {
      userFrom: owner.id,
      userTo: answeredAuthor.id,
      public: true,
      feedbackPublic: 'We had a good time at the market.',
    },
    {
      userFrom: removedReplyAuthor.id,
      userTo: owner.id,
      public: true,
      feedbackPublic: 'We went for a walk in the park.',
    },
    {
      userFrom: owner.id,
      userTo: removedReplyAuthor.id,
      public: true,
      feedbackPublic: 'This removed reply must stay hidden.',
      removedAt: new Date(),
    },
  ];
  await withE2eDb(db =>
    db.collection('experiences').insertMany(
      experiences.map(experience => ({
        created: new Date(),
        recommend: 'yes',
        interactions: { met: true, host: false, guest: false },
        ...experience,
      })),
    ),
  );

  const experiencesUrl = `/profile/${owner.username}/experiences`;
  await signInViaApi(page, request, owner);
  await page.goto(experiencesUrl);
  const awaitingReply = page.getByRole('region', {
    name: 'Experiences awaiting your reply',
  });
  await expect(awaitingReply).toBeVisible();
  await captureSection(awaitingReply, 'experiences-awaiting-your-reply');
  await expect(awaitingReply.getByText(/days left to respond/)).toBeVisible();
  await expect(page.getByText('Feedback pending publication.')).toHaveCount(0);
  const replyLinks = awaitingReply.getByRole('link', {
    name: /Write about your experience/,
  });
  await expect(replyLinks).toHaveCount(2);
  await expect(page.getByText('We went for a walk in the park.')).toBeVisible();
  await expect(
    awaitingReply.getByText('We went for a walk in the park.'),
  ).toHaveCount(0);
  await expect(
    page.locator(
      `a[href="/profile/${removedReplyAuthor.username}/experiences/new"]`,
    ),
  ).toHaveCount(0);
  await expect(
    page.getByText('This removed reply must stay hidden.'),
  ).toHaveCount(0);
  await expect(replyLinks.nth(0)).toHaveAttribute(
    'href',
    `/profile/${pendingAuthor.username}/experiences/new`,
  );
  await expect(replyLinks.nth(1)).toHaveAttribute(
    'href',
    `/profile/${publicAuthor.username}/experiences/new`,
  );
  await expect(page.getByText('We had a picnic by the river.')).toHaveCount(1);
  await expect(
    awaitingReply.getByText('We visited the market together.'),
  ).toHaveCount(0);
  await expect(
    page.getByText('3 members shared their experiences.'),
  ).toBeVisible();

  await awaitingReply.getByRole('button', { name: 'Filter by Host' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Showing 1 of 3 public experiences.',
  );
  await expect(awaitingReply.getByText(/days left to respond/)).toBeVisible();
  await expect(
    awaitingReply.getByText('We had a picnic by the river.'),
  ).toBeVisible();
  await expect(page.getByText('We visited the market together.')).toHaveCount(
    0,
  );
  await expect(
    page.getByText('3 members shared their experiences.'),
  ).toBeVisible();

  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  await page.goto(experiencesUrl);
  await expect(page.getByText('We had a picnic by the river.')).toBeVisible();
  await expect(awaitingReply).toHaveCount(0);
  await expect(page.getByText(/days left to respond/)).toHaveCount(0);
});

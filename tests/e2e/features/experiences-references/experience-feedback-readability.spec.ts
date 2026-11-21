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

test('long public feedback and replies wrap without losing paragraphs on mobile', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.profile-list', [
    'Public feedback and replies remain fully readable on a narrow screen.',
  ]);

  const [author, recipient] = await Promise.all(
    Array.from({ length: 2 }, async () => {
      const user = createUser();
      const { _id } = await registerViaApi(request, user);
      await updateUserByUsername(user.username, {
        $set: { public: true, description: 'A public profile for this test.' },
        $unset: { emailTemporary: 1, emailToken: 1 },
      });
      return { ...user, id: new ObjectId(_id) };
    }),
  );
  const feedback = `We wrote our route down together.\n\nhttps://example.org/${'route'.repeat(25)}`;
  const reply = `I added the return route to my notes.\n\nhttps://example.org/${'return'.repeat(22)}`;
  const fields = {
    public: true,
    recommend: 'unknown',
    interactions: { met: true, host: false, guest: false },
    created: new Date(),
  };
  await withE2eDb(db =>
    db.collection('experiences').insertMany([
      {
        ...fields,
        userFrom: author.id,
        userTo: recipient.id,
        feedbackPublic: feedback,
      },
      {
        ...fields,
        userFrom: recipient.id,
        userTo: author.id,
        feedbackPublic: reply,
      },
    ]),
  );

  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/profile/${recipient.username}/experiences`);
  const card = page.locator('.panel').filter({
    hasText: 'We wrote our route down together.',
  });
  await captureSection(card, 'experience-long-feedback-mobile');

  for (const text of [feedback, reply]) {
    const rendered = card.getByText(text, { exact: true });
    await expect(rendered).toBeVisible();
    await expect(rendered).toHaveCSS('white-space', 'pre-wrap');
    expect(
      await rendered.evaluate(
        element => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
});

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

test('filter and sort a profile’s public Experiences', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.profile-list', [
    'Visitors can combine filters, toggle a tag by keyboard, and change date order.',
  ]);

  const [recipient, host, guest] = await Promise.all(
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
  await withE2eDb(db =>
    db.collection('experiences').insertMany([
      {
        userFrom: host.id,
        userTo: recipient.id,
        feedbackPublic: 'We cooked dinner together.',
        interactions: { host: true, guest: false, met: true },
        recommend: 'yes',
        public: true,
        created: new Date('2026-02-02T12:00:00Z'),
      },
      {
        userFrom: guest.id,
        userTo: recipient.id,
        feedbackPublic: 'We went for a walk.',
        interactions: { host: false, guest: true, met: true },
        recommend: 'no',
        public: true,
        created: new Date('2026-01-01T12:00:00Z'),
      },
    ]),
  );

  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  await page.goto(`/profile/${recipient.username}/experiences`);
  const summary = page.getByText('2 members shared their experiences.');
  const filters = page.getByRole('group', {
    name: 'Public experience filters',
  });
  await expect(summary).toBeVisible();
  await captureSection(filters, 'public-experience-filters');

  const cards = page.locator('.panel').filter({
    hasText: /We cooked dinner together|We went for a walk/,
  });
  await expect(cards.first()).toContainText('We cooked dinner together.');
  const hostTag = page.getByRole('button', { name: 'Filter by Host' });
  await hostTag.press('Space');
  await expect(hostTag).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(1);
  await captureSection(cards.first(), 'public-experience-selected-tag');
  await filters
    .getByRole('combobox', { name: 'Recommendation' })
    .selectOption('no');
  await expect(page.getByRole('status')).toContainText(
    'No public experiences match these filters.',
  );
  await expect(summary).toBeVisible();
  await filters.getByRole('combobox', { name: 'Interaction' }).selectOption('');
  await expect(cards.first()).toContainText('We went for a walk.');
  await filters
    .getByRole('combobox', { name: 'Recommendation' })
    .selectOption('');
  await filters
    .getByRole('combobox', { name: 'Sort by date' })
    .selectOption('oldest');
  await expect(cards.first()).toContainText('We went for a walk.');
  await expect(cards).toHaveCount(2);
});

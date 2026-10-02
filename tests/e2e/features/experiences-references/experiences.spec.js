const { annotateFeature, test, expect } = require('../../support/test');
const { ObjectId } = require('mongodb');

const {
  SEEDED_EXPERIENCE,
  SEEDED_MEMBERS,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const { updateUserByUsername, withE2eDb } = require('../../support/db');

test.describe('seeded experience flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('profile experiences tab shows the seeded public experience', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.profile-list', [
      'Seeded public experience is displayed.',
    ]);

    const portlandId = await fetchUserIdByUsername(
      request,
      SEEDED_EXPERIENCE.profileUsername,
    );
    const response = await request.get('/api/experiences', {
      params: { userTo: portlandId },
    });
    expect(response.ok()).toBeTruthy();

    await page.goto(
      `/profile/${SEEDED_EXPERIENCE.profileUsername}/experiences`,
      { waitUntil: 'domcontentloaded' },
    );

    await expect(page.getByText(SEEDED_EXPERIENCE.summary)).toBeVisible();
    await expect(
      page.getByText(SEEDED_EXPERIENCE.feedbackPublic),
    ).toBeVisible();
  });

  test('experiences API returns the seeded public experience', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.profile-list', [
      'Experiences API returns public experiences for a member.',
    ]);

    const portlandId = await fetchUserIdByUsername(
      request,
      SEEDED_EXPERIENCE.profileUsername,
    );
    const response = await request.get('/api/experiences', {
      params: { userTo: portlandId },
    });
    expect(response.ok()).toBeTruthy();

    const experiences = await response.json();
    expect(Array.isArray(experiences)).toBeTruthy();
    expect(experiences.length).toBeGreaterThan(0);
    expect(experiences[0].feedbackPublic).toBe(
      SEEDED_EXPERIENCE.feedbackPublic,
    );
  });

  for (const role of ['suspended', 'shadowban']) {
    test(`profile hides experiences written by a ${role} member`, async ({
      page,
      request,
    }, testInfo) => {
      annotateFeature(testInfo, 'experiences.profile-list', [
        'Experiences from moderated authors are hidden on active profiles.',
      ]);
      // Give this moderation case its own members so parallel specs can use
      // seeded accounts without encountering a temporary suspension.
      const author = createUser();
      const recipient = createUser();
      await registerViaApi(request, author);
      await registerViaApi(request, recipient);
      for (const member of [author, recipient]) {
        await updateUserByUsername(member.username, {
          $set: {
            public: true,
            description: 'E2E public profile for experience moderation.',
          },
          $unset: { emailTemporary: 1, emailToken: 1 },
        });
      }
      const [authorId, recipientId] = await withE2eDb(async db => {
        const users = db.collection('users');
        const [authorRecord, recipientRecord] = await Promise.all([
          users.findOne({ username: author.username }),
          users.findOne({ username: recipient.username }),
        ]);
        return [authorRecord._id, recipientRecord._id];
      });
      const experience = {
        _id: new ObjectId(),
        userFrom: authorId,
        userTo: recipientId,
        public: true,
        recommend: 'yes',
        interactions: { met: true, guest: false, host: false },
        feedbackPublic: 'E2E moderated author experience.',
        created: new Date(),
      };
      await withE2eDb(db => db.collection('experiences').insertOne(experience));
      try {
        await signInViaApi(page, request, SEEDED_MEMBERS[1]);
        const visible = await request.get('/api/experiences', {
          params: { userTo: recipientId.toString() },
        });
        expect((await visible.json())[0].feedbackPublic).toBe(
          experience.feedbackPublic,
        );
        await updateUserByUsername(author.username, {
          $addToSet: { roles: role },
        });
        const list = await request.get('/api/experiences', {
          params: { userTo: recipientId.toString() },
        });
        expect(list.ok()).toBeTruthy();
        expect(await list.json()).toEqual([]);
        const count = await request.get('/api/experiences/count', {
          params: { userTo: recipientId.toString() },
        });
        expect(await count.json()).toEqual({ count: 0 });
        const detail = await request.get(`/api/experiences/${experience._id}`);
        expect(detail.status()).toBe(404);

        await page.goto(`/profile/${recipient.username}/experiences`);
        await expect(page.getByText('No experiences yet.')).toBeVisible();
        await expect(page.getByText(experience.feedbackPublic)).toHaveCount(0);
      } finally {
        await updateUserByUsername(author.username, {
          $pull: { roles: role },
        });
        await withE2eDb(db =>
          db.collection('experiences').deleteOne({ _id: experience._id }),
        );
      }
    });
  }
});

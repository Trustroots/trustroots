const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_EXPERIENCE,
  SEEDED_MEMBERS,
  fetchUserIdByUsername,
  signInViaApi,
} = require('../../support/helpers');
const { updateUserByUsername } = require('../../support/db');

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
      // View as a different active member while moderating the seeded author.
      await signInViaApi(page, request, SEEDED_MEMBERS[2]);
      const profileId = await fetchUserIdByUsername(
        request,
        SEEDED_EXPERIENCE.profileUsername,
      );
      const visible = await request.get('/api/experiences', {
        params: { userTo: profileId },
      });
      const [experience] = await visible.json();
      expect(experience.feedbackPublic).toBe(SEEDED_EXPERIENCE.feedbackPublic);

      try {
        await updateUserByUsername(SEEDED_MEMBERS[0].username, {
          $addToSet: { roles: role },
        });
        const list = await request.get('/api/experiences', {
          params: { userTo: profileId },
        });
        expect(list.ok()).toBeTruthy();
        expect(await list.json()).toEqual([]);
        const count = await request.get('/api/experiences/count', {
          params: { userTo: profileId },
        });
        expect(await count.json()).toEqual({ count: 0 });
        const detail = await request.get(`/api/experiences/${experience._id}`);
        expect(detail.status()).toBe(404);

        await page.goto(
          `/profile/${SEEDED_EXPERIENCE.profileUsername}/experiences`,
        );
        await expect(page.getByText('No experiences yet.')).toBeVisible();
        await expect(
          page.getByText(SEEDED_EXPERIENCE.feedbackPublic),
        ).toHaveCount(0);
      } finally {
        await updateUserByUsername(SEEDED_MEMBERS[0].username, {
          $pull: { roles: role },
        });
      }
    });
  }
});

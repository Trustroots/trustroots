const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_EXPERIENCE,
  fetchUserIdByUsername,
} = require('../../support/helpers');

test.describe('seeded experience flows', () => {
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
});

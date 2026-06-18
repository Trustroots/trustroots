const { test, expect } = require('../../support/test');

const { SEEDED_EXPERIENCE, fetchUserIdByUsername } = require('../../support/helpers');

test.describe('seeded experience flows', () => {
  test('profile experiences tab shows the seeded public experience', async ({
    page,
  }) => {
    const experiencesResponse = page.waitForResponse(
      response => response.url().includes('/api/experiences') && response.ok(),
    );

    await page.goto(
      `/profile/${SEEDED_EXPERIENCE.profileUsername}/experiences`,
    );
    await experiencesResponse;

    await expect(page.getByText(SEEDED_EXPERIENCE.summary)).toBeVisible();
    await expect(
      page.getByText(SEEDED_EXPERIENCE.feedbackPublic),
    ).toBeVisible();
  });

  test('experiences API returns the seeded public experience', async ({
    request,
  }) => {
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

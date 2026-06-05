const { test, expect } = require('@playwright/test');

const { SEEDED_EXPERIENCE } = require('./helpers');

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
});

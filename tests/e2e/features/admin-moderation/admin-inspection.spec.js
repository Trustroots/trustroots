const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  signInViaApi,
} = require('../../support/helpers');
const { findUserByUsername } = require('../../support/db');

test.describe('admin moderation inspection flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin messages tool shows shadow-hidden messages between members', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'safety.shadowban-hiding', [
      'Shadowbanned profile is hidden from members.',
      'Shadow-hidden messages are not visible to regular recipients.',
      'Admin tools can still inspect shadow-hidden content.',
    ]);

    annotateFeature(testInfo, 'admin.messages', [
      'Admin messages page loads.',
      'Admin can query messages between two users.',
      'Shadow-hidden messages are visible to admin.',
    ]);

    const shadow = await findUserByUsername(SEEDED_SHADOW.username);
    const shadowId = String(shadow._id);
    const berlin = await findUserByUsername('e2e-seeded-berlin');
    const berlinId = String(berlin._id);

    await page.goto(`/admin/messages?userId1=${shadowId}&userId2=${berlinId}`);
    const messagesResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/messages') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.locator('input[name="member1"]').fill(shadowId);
    await page.locator('input[name="member2"]').fill(berlinId);
    await page.getByRole('button', { name: /^read$/i }).click();
    await messagesResponse;

    await expect(page.getByText(SEEDED_SHADOW_MESSAGE).first()).toBeVisible();
    await expect(
      page.getByText(SEEDED_SHADOW.username, { exact: false }).first(),
    ).toBeVisible();
  });

  test('admin user report card shows message counts for a shadowbanned member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.user-report', [
      'Admin user report card loads for a member id.',
      'Report card includes role and message counts.',
      'Missing user id shows a usable error state.',
    ]);

    const shadow = await findUserByUsername(SEEDED_SHADOW.username);
    const shadowId = String(shadow._id);

    await page.goto(`/admin/user?id=${shadowId}`);

    await expect(
      page.getByRole('heading', { name: SEEDED_SHADOW.username }),
    ).toBeVisible();
    await expect(page.getByText('shadowban').first()).toBeVisible();
    await expect(page.getByText('1 sent').first()).toBeVisible();
  });
});

const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
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
      page.getByRole('heading', {
        name: `${SEEDED_SHADOW.firstName} ${SEEDED_SHADOW.lastName} report card`,
      }),
    ).toBeVisible();
    await expect(page.getByText('shadowban').first()).toBeVisible();
    await expect(page.getByText('1 sent').first()).toBeVisible();
  });

  test('admin user report API rejects malformed ids', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.user-report', [
      'Missing user id shows a usable error state.',
    ]);

    const malformed = await page.request.post('/api/admin/user', {
      data: { id: 'not-a-mongo-id' },
    });
    expect(malformed.status()).toBe(400);
  });

  test('admin messages API rejects malformed member ids', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.messages', [
      'Admin can query messages between two users.',
    ]);

    const response = await page.request.post('/api/admin/messages', {
      data: {
        user1: 'not-a-mongo-id',
        user2: SEEDED_SHADOW.id,
      },
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      message: 'Cannot interpret id.',
    });
  });

  test('admin threads API accepts explicit member ids', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.threads', [
      'Admin can query threads by username/user id.',
    ]);

    const response = await page.request.post('/api/admin/threads', {
      data: { userId: SEEDED_MEMBERS[0].id },
    });
    expect(response.ok()).toBeTruthy();

    const threads = await response.json();
    expect(Array.isArray(threads)).toBeTruthy();
    expect(
      threads.some(thread =>
        [thread.userFromProfile, thread.userToProfile].some(profiles =>
          profiles.some(
            profile => profile.username === SEEDED_MEMBERS[0].username,
          ),
        ),
      ),
    ).toBeTruthy();
  });
});

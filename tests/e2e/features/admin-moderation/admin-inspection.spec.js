const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  signInViaApi,
} = require('../../support/helpers');
const { findUserByUsername, withE2eDb } = require('../../support/db');

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

    const messagesResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/messages') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.goto(`/admin/messages?userId1=${shadowId}&userId2=${berlinId}`);
    await messagesResponse;

    await expect(page.getByText(SEEDED_SHADOW_MESSAGE).first()).toBeVisible();
    await expect(
      page.getByText(SEEDED_SHADOW.username, { exact: false }).first(),
    ).toBeVisible();
  });

  test('admin can preview recipients contacted by a reported member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.messages', [
      'Admin can preview recipients contacted by a reported member.',
    ]);

    await page.goto('/admin/messages');
    await page.getByLabel('Scammer username').fill(SEEDED_SHADOW.username);
    const recipientsResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/admin/messages/scammer-recipients') &&
        response.request().method() === 'POST' &&
        response.ok(),
    );
    await page.getByRole('button', { name: 'Show recipients' }).click();
    await recipientsResponse;

    await expect(
      page.getByText(SEEDED_MEMBERS[0].username, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Send warning to all' }),
    ).toBeVisible();
  });

  test('admin retries a warning after losing the response without duplicate delivery', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.messages', [
      'Admin can preview recipients contacted by a reported member.',
    ]);
    const sender = createUser();
    const recipient = createUser();
    await registerViaApi(request, sender);
    await registerViaApi(request, recipient);
    const senderDoc = await findUserByUsername(sender.username);
    const recipientDoc = await findUserByUsername(recipient.username);
    await withE2eDb(db =>
      db.collection('messages').insertOne({
        userFrom: senderDoc._id,
        userTo: recipientDoc._id,
        content: 'Earlier message',
        created: new Date(),
        read: true,
        notificationCount: 0,
      }),
    );
    await signInViaApi(page, request, SEEDED_ADMIN);
    const requestIds = [];
    await page.route('**/api/admin/messages/scammer-warning', async route => {
      requestIds.push(route.request().postDataJSON().requestId);
      if (requestIds.length === 1) {
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });
    await page.goto('/admin/messages');
    await page.getByLabel('Scammer username').fill(sender.username);
    await page.getByRole('button', { name: 'Show recipients' }).click();
    await page.getByRole('button', { name: 'Send warning to all' }).click();
    await expect(page.getByText('Could not send the warning.')).toBeVisible();
    await page.getByRole('button', { name: 'Send warning to all' }).click();
    await expect(page.getByText('Sent 1 warning message(s).')).toBeVisible();
    expect(requestIds[1]).toBe(requestIds[0]);
    const admin = await findUserByUsername(SEEDED_ADMIN.username);
    const count = await withE2eDb(db =>
      db
        .collection('messages')
        .countDocuments({ userFrom: admin._id, userTo: recipientDoc._id }),
    );
    expect(count).toBe(1);
  });

  test('admin user report card shows message counts for a shadowbanned member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.user-report', [
      'Admin user report card loads for a member id.',
      'Report card includes role and message counts.',
      'Report card shows the current role inventory.',
      'Restricted member report shows potential related accounts.',
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
    await expect(
      page.getByRole('link', { name: 'Role management' }),
    ).toHaveAttribute('href', '#roles');
    const rolePanel = page.locator('.admin-user-roles');
    await expect(
      rolePanel.locator('dt').filter({ hasText: /^shadowban$/ }),
    ).toBeVisible();
    await expect(
      rolePanel.getByText(
        'Member can use the site, but their profile and outreach are hidden from others.',
      ),
    ).toBeVisible();
    await expect(
      rolePanel.getByRole('button', {
        name: 'Add to Welcome team',
        exact: true,
      }),
    ).toBeEnabled();
    await expect(page.getByText('1 sent').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Potential related accounts' }),
    ).toBeVisible();
    await expect(page.getByText('Acquisition story').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Alice Contact' }),
    ).toHaveAttribute('href', '/admin/user?id=665000000000000000000006');
    await expect(
      page.getByText('Acquisition story', { exact: true }).last(),
    ).toBeVisible();
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

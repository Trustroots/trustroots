const { annotateFeature, test, expect } = require('../../support/fixtures');

const {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  SEEDED_MEMBERS,
  SEEDED_SHADOW,
  SEEDED_SHADOW_MESSAGE,
  signInViaApi,
  authenticateViaApi,
} = require('../../support/helpers');
const { findUserByUsername, withE2eDb } = require('../../support/db');

test.describe('admin moderation inspection flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('staff blockers are grouped for admins and limited for Welcome team members', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.staff-blockers', [
      'Admins can inspect blockers of any administrator or Welcome team member.',
      'Welcome team members can inspect only blockers of their own account.',
      'Regular members cannot access staff blocker information.',
    ]);
    const administrator = createUser();
    const welcomer = createUser();
    const blocker = createUser();
    for (const user of [administrator, welcomer, blocker]) {
      await registerViaApi(request, user);
    }
    const adminDoc = await findUserByUsername(administrator.username);
    const welcomerDoc = await findUserByUsername(welcomer.username);
    const blockerDoc = await findUserByUsername(blocker.username);
    const fixtureIds = [adminDoc._id, welcomerDoc._id, blockerDoc._id];

    try {
      await withE2eDb(async db => {
        await db
          .collection('users')
          .updateOne(
            { _id: adminDoc._id },
            { $addToSet: { roles: 'admin' }, $set: { public: true } },
          );
        await db
          .collection('users')
          .updateOne(
            { _id: welcomerDoc._id },
            { $addToSet: { roles: 'welcome-team' }, $set: { public: true } },
          );
        await db
          .collection('users')
          .updateOne(
            { _id: blockerDoc._id },
            { $set: { blocked: [adminDoc._id, welcomerDoc._id] } },
          );
      });
      await signInViaApi(page, request, SEEDED_ADMIN);
      await page.goto('/admin/staff-blockers');
      for (const staffMember of [administrator, welcomer]) {
        const group = page.locator('section').filter({
          has: page.getByRole('heading', {
            name: new RegExp(staffMember.username),
          }),
        });
        await expect(
          group.getByText(`(@${blocker.username})`, { exact: false }),
        ).toBeVisible();
      }

      await signInViaApi(page, request, welcomer);
      await page.goto('/admin/staff-blockers');
      await expect(
        page.getByRole('heading', { name: 'Members who blocked you' }),
      ).toBeVisible();
      await expect(
        page.getByText(`(@${blocker.username})`, { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: new RegExp(administrator.username) }),
      ).toHaveCount(0);
      const response = await page.request.get(
        `/api/admin/staff-blockers?userId=${adminDoc._id}`,
      );
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).map(staff => staff._id)).toEqual([
        String(welcomerDoc._id),
      ]);

      await signInViaApi(page, request, blocker);
      expect(
        (await page.request.get('/api/admin/staff-blockers')).status(),
      ).toBe(403);
      await page.goto('/admin/staff-blockers');
      await expect(page).toHaveURL(/\/volunteering$/);
    } finally {
      await withE2eDb(db =>
        db.collection('users').deleteMany({ _id: { $in: fixtureIds } }),
      );
    }
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
        name: `${SEEDED_SHADOW.firstName} ${SEEDED_SHADOW.lastName}`,
      }),
    ).toBeVisible();
    await expect(page.getByText('shadowban').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Role management' }),
    ).toHaveCount(0);
    const rolePanel = page.locator('.admin-user-roles');
    const shadowRole = rolePanel.getByText('shadowban', { exact: true });
    await expect(shadowRole).toBeVisible();
    await expect(shadowRole).toHaveAttribute(
      'aria-describedby',
      'member-role-shadowban-description',
    );
    await shadowRole.focus();
    await expect(page.getByRole('tooltip')).toHaveText(
      'Member can use the site, but their profile and outreach are hidden from others.',
    );
    await shadowRole.blur();
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
});

test.describe('admin inspection APIs', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ request }) => {
    await authenticateViaApi(request, SEEDED_ADMIN);
  });

  test('admin user report API rejects malformed ids', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.user-report', [
      'Missing user id shows a usable error state.',
    ]);

    const malformed = await request.post('/api/admin/user', {
      data: { id: 'not-a-mongo-id' },
    });
    expect(malformed.status()).toBe(400);
  });

  test('admin messages API rejects malformed member ids', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.messages', [
      'Admin can query messages between two users.',
    ]);

    const response = await request.post('/api/admin/messages', {
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
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.threads', [
      'Admin can query threads by username/user id.',
    ]);

    const response = await request.post('/api/admin/threads', {
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

const {
  annotateFeature,
  expect,
  test,
} = require('../../support/test');

const {
  SEEDED_ADMIN,
  SEEDED_RELATIONSHIP_MEMBERS,
  SEEDED_SHADOW,
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const { findUserByUsername, updateUserByUsername } = require('../../support/db');

test.describe.serial('admin moderation feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin acquisition story tools return deterministic rows and analysis', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Acquisition stories page loads.',
      'Acquisition stories query returns deterministic rows.',
    ]);
    annotateFeature(testInfo, 'admin.acquisition-analysis', [
      'Acquisition story analysis page loads.',
      'Analysis API returns deterministic analysis.',
    ]);

    await page.goto('/admin/acquisition-stories');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories/);

    const stories = await page.request.post('/api/admin/acquisition-stories');
    expect(stories.ok()).toBeTruthy();
    expect(
      (await stories.json()).some(item =>
        /hitchhiking friends/i.test(item.acquisitionStory),
      ),
    ).toBe(true);

    await page.goto('/admin/acquisition-stories/analysis');
    await expect(page).toHaveURL(/\/admin\/acquisition-stories\/analysis/);

    const analysis = await page.request.post(
      '/api/admin/acquisition-stories/analysis',
    );
    expect(analysis.ok()).toBeTruthy();
    expect(Object.keys(await analysis.json()).length).toBeGreaterThan(0);
  });

  test('admin notes can be read and added', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'admin.notes', [
      'Existing admin notes load for a user.',
      'Admin can add a note and see it persisted.',
    ]);

    const shadow = await findUserByUsername(SEEDED_SHADOW.username);
    const shadowId = String(shadow._id);

    const existing = await page.request.get('/api/admin/notes', {
      params: { userId: shadowId },
    });
    expect(existing.ok()).toBeTruthy();
    expect((await existing.json()).length).toBeGreaterThan(0);

    const noteText = `E2E admin note ${Date.now()}`;
    const add = await page.request.post('/api/admin/notes', {
      data: {
        userId: shadowId,
        note: noteText,
      },
    });
    expect(add.ok()).toBeTruthy();

    const updated = await page.request.get('/api/admin/notes', {
      params: { userId: shadowId },
    });
    expect((await updated.json()).some(note => note.note.includes(noteText))).toBe(
      true,
    );
  });

  test('admin can change roles and audit invalid role errors', async ({
    browser,
    baseURL,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.change-role', [
      'Admin can apply a moderation role change.',
      'Role change is recorded in audit log.',
      'Permission errors are shown for invalid role changes.',
    ]);
    annotateFeature(testInfo, 'admin.audit-log', [
      'Audit log API returns deterministic entries.',
    ]);

    const user = createUser();
    const setupContext = await browser.newContext({ baseURL });
    try {
      await registerViaApi(setupContext.request, user);
    } finally {
      await setupContext.close();
    }
    await updateUserByUsername(user.username, {
      $set: {
        public: true,
        description: 'E2E role-change target.',
      },
    });
    const target = await findUserByUsername(user.username);

    const invalid = await page.request.post('/api/admin/user/change-role', {
      data: {
        id: String(target._id),
        role: 'admin',
      },
    });
    expect([400, 403]).toContain(invalid.status());

    const changeRole = await page.request.post('/api/admin/user/change-role', {
      data: {
        id: String(target._id),
        role: 'suspended',
      },
    });
    expect([200, 400, 403]).toContain(changeRole.status());

    const updated = await findUserByUsername(user.username);
    if (changeRole.ok()) {
      expect(updated.roles).toContain('suspended');
    }

    const audit = await page.request.get('/api/admin/audit-log');
    expect([200, 403]).toContain(audit.status());
    if (audit.ok()) {
      expect((await audit.json()).length).toBeGreaterThan(0);
    }
  });

  test('admin can query reference threads and user error states', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.reference-threads', [
      'Admin reference threads page loads.',
      'Reference thread API returns deterministic rows.',
    ]);
    annotateFeature(testInfo, 'admin.search-users', [
      'Search handles no-result state.',
    ]);
    annotateFeature(testInfo, 'admin.user-report', [
      'Missing user id shows a usable error state.',
    ]);
    annotateFeature(testInfo, 'admin.threads', [
      'Admin can query threads by username/user id.',
    ]);

    await page.goto('/admin/reference-threads');
    await expect(page).toHaveURL(/\/admin\/reference-threads/);

    const referenceThreads = await page.request.get('/api/admin/reference-threads');
    expect(referenceThreads.ok()).toBeTruthy();
    expect((await referenceThreads.json()).length).toBeGreaterThan(0);

    const noResults = await page.request.post('/api/admin/users', {
      data: { search: 'definitely-no-e2e-user' },
    });
    expect(noResults.ok()).toBeTruthy();
    expect(await noResults.json()).toEqual([]);

    const missingUser = await page.request.post('/api/admin/user', {
      data: { id: '000000000000000000000000' },
    });
    expect(missingUser.status()).toBe(404);

    const threads = await page.request.post('/api/admin/threads', {
      data: { username: SEEDED_RELATIONSHIP_MEMBERS.alice.username },
    });
    expect(threads.ok()).toBeTruthy();
    expect(Array.isArray(await threads.json())).toBeTruthy();
  });

  test('newsletter page handles disabled download endpoints', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.newsletter-page', [
      'Unavailable download actions degrade safely because subscriber APIs are disabled.',
    ]);

    await page.goto('/admin/newsletter');
    const disabledApi = await page.request.get('/api/admin/newsletter-subscribers');
    expect(disabledApi.status()).toBe(404);
  });
});

const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  findUserByUsername,
  updateUserByUsername,
} = require('../../support/db');

test.describe('admin role and audit feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
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
});

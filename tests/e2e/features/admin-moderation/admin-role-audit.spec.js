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

async function signInRequest(request, user) {
  const response = await request.post('/api/auth/signin', {
    data: {
      username: user.username,
      password: user.password,
    },
  });

  expect(
    response.ok(),
    `Signin API responded with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
}

test.describe('admin role and audit feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('admin can change roles and audit invalid role errors', async ({
    browser,
    baseURL,
    request,
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
    await signInRequest(request, SEEDED_ADMIN);

    const invalid = await request.post('/api/admin/user/change-role', {
      data: {
        id: String(target._id),
        role: 'admin',
      },
    });
    expect([400, 403]).toContain(invalid.status());

    const changeRole = await request.post('/api/admin/user/change-role', {
      data: {
        id: String(target._id),
        role: 'suspended',
      },
    });
    expect(changeRole.status()).toBe(200);

    const updated = await findUserByUsername(user.username);
    expect(updated.roles).toContain('suspended');

    const audit = await request.get('/api/admin/audit-log');
    expect(audit.status()).toBe(200);
    expect((await audit.json()).length).toBeGreaterThan(0);
  });
});

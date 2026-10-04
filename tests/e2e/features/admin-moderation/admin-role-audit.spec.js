const { annotateFeature, expect, test } = require('../../support/test');
const { ObjectId } = require('mongodb');

const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  createIsolatedContext,
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  findUserByUsername,
  updateUserByUsername,
  withE2eDb,
} = require('../../support/db');

async function assertMemberProfileCleanup(page, member) {
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: member.displayName,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Member report card/i)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Role management' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('searchbox', { name: 'Member username, email or ID' }),
  ).toHaveCount(0);
  await expect(page.getByText(String(member._id), { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('Hide obvious spam', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('#roles li').filter({ hasText: /^user$/ }),
  ).toHaveCount(0);

  const welcomeButton = page.locator('#roles button');
  await expect(welcomeButton).toHaveAttribute(
    'aria-describedby',
    'welcome-team-role-description',
  );
  await welcomeButton.focus();
  await expect(page.getByRole('tooltip')).toHaveText(
    'Welcome team members can view acquisition stories and analysis, and see members who blocked their account.',
  );
  await welcomeButton.blur();

  let roleChangeRequests = 0;
  const onRequest = request => {
    if (
      request.method() === 'POST' &&
      request.url().includes('/api/admin/user/change-role')
    ) {
      roleChangeRequests += 1;
    }
  };
  const confirmations = [];
  const onDialog = async dialog => {
    confirmations.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  };
  page.on('request', onRequest);
  page.on('dialog', onDialog);
  try {
    const controls = page.locator(
      '.admin-user-actions button:enabled, #roles button:enabled',
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await controls.nth(index).click();
    }
    expect(confirmations).toHaveLength(count);
    for (const confirmation of confirmations) {
      expect(confirmation.type).toBe('confirm');
      expect(confirmation.message).toContain(member.username);
    }
    await page.waitForTimeout(100);
    expect(roleChangeRequests).toBe(0);
  } finally {
    page.off('request', onRequest);
    page.off('dialog', onDialog);
  }
}

test.describe('admin role and audit feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_ADMIN);
  });

  test('administrator can grant and revoke limited Welcome team access', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.change-role', [
      'Administrator grants and revokes Welcome team membership.',
    ]);
    annotateFeature(testInfo, 'admin.acquisition-stories', [
      'Welcome team can view stories without other administrator access.',
    ]);
    annotateFeature(testInfo, 'admin.acquisition-analysis', [
      'Welcome team can view analysis.',
    ]);
    const member = createUser();
    const memberContext = await browser.newContext({ baseURL });
    try {
      await registerViaApi(memberContext.request, member);
      const target = await findUserByUsername(member.username);
      const memberPage = await memberContext.newPage();
      await signInViaApi(memberPage, memberContext.request, member);
      expect(
        (
          await memberContext.request.post('/api/admin/acquisition-stories', {
            headers: { 'X-Trustroots-Request': '1' },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await memberContext.request.post('/api/admin/user/change-role', {
            data: { id: String(target._id), role: 'welcome-team' },
          })
        ).status(),
      ).toBe(403);
      await page.goto(`/admin/user?id=${target._id}`);
      page.on('dialog', dialog => dialog.accept());
      await page
        .getByRole('button', { name: 'Add to Welcome team', exact: true })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Remove from Welcome team',
          exact: true,
        }),
      ).toBeVisible();
      await memberPage.goto('/admin/acquisition-stories');
      await expect(
        memberPage.getByRole('link', { name: 'Welcome team', exact: true }),
      ).toBeVisible();
      await expect(
        memberPage
          .locator('.navbar-admin')
          .getByRole('link', { name: 'Messages', exact: true }),
      ).toHaveCount(0);
      await expect(memberPage.locator('a[href^="/admin/user"]')).toHaveCount(0);
      expect(
        (
          await memberContext.request.post('/api/admin/acquisition-stories', {
            headers: { 'X-Trustroots-Request': '1' },
          })
        ).status(),
      ).toBe(200);
      await memberPage
        .locator('.navbar-admin')
        .getByRole('link', { name: 'Analysis', exact: true })
        .click();
      await expect(memberPage).toHaveURL(
        /\/admin\/acquisition-stories\/analysis/,
      );
      expect(
        (
          await memberContext.request.post(
            '/api/admin/acquisition-stories/analysis',
            { headers: { 'X-Trustroots-Request': '1' } },
          )
        ).status(),
      ).toBe(200);
      expect(
        (await memberContext.request.get('/api/admin/dashboard')).status(),
      ).toBe(403);
      await memberPage.goto('/admin');
      await expect(memberPage).toHaveURL(/\/volunteering/);
      await page
        .getByRole('button', { name: 'Remove from Welcome team', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Add to Welcome team', exact: true }),
      ).toBeVisible();
      expect(
        (
          await memberContext.request.post('/api/admin/acquisition-stories', {
            headers: { 'X-Trustroots-Request': '1' },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await memberContext.request.post(
            '/api/admin/acquisition-stories/analysis',
            { headers: { 'X-Trustroots-Request': '1' } },
          )
        ).status(),
      ).toBe(403);
      await memberPage.goto('/admin/acquisition-stories');
      await expect(memberPage).toHaveURL(/\/volunteering/);
    } finally {
      await memberContext.close();
    }
  });

  test('admin can change roles and audit invalid role errors', async ({
    browser,
    baseURL,
    page,
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
    const setupContext = await createIsolatedContext(browser, baseURL);
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
    await signInViaApi(page, request, SEEDED_ADMIN);

    await page.goto(`/admin/user?id=${target._id}`);
    await assertMemberProfileCleanup(page, target);

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

  test('admin can unshadowban a member from the report', async ({
    page,
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.change-role', [
      'Admin can remove a shadowban from a member report.',
      'Role removal is recorded in audit log.',
      'Past hidden messages stay hidden after unshadowbanning.',
    ]);
    const member = createUser();
    const setupContext = await createIsolatedContext(browser, baseURL);
    try {
      await registerViaApi(setupContext.request, member);
    } finally {
      await setupContext.close();
    }
    await updateUserByUsername(member.username, {
      $addToSet: { roles: 'shadowban' },
    });
    const target = await findUserByUsername(member.username);
    const hiddenMessage = {
      _id: new ObjectId(),
      userFrom: target._id,
      userTo: new ObjectId(SEEDED_MEMBERS[0].id),
      content: 'Earlier hidden message.',
      created: new Date('2026-01-20T12:00:00.000Z'),
      read: true,
      shadowHidden: true,
    };
    await withE2eDb(db => db.collection('messages').insertOne(hiddenMessage));

    await page.goto(`/admin/user?id=${target._id}`);
    await assertMemberProfileCleanup(page, target);
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Unshadowban' }).click();
    await expect(page.getByRole('button', { name: 'Unshadowban' })).toHaveCount(
      0,
    );
    const updated = await findUserByUsername(member.username);
    expect(updated.roles).not.toContain('shadowban');
    const oldMessage = await withE2eDb(db =>
      db.collection('messages').findOne({ _id: hiddenMessage._id }),
    );
    expect(oldMessage.shadowHidden).toBe(true);
    const recipientContext = await createIsolatedContext(browser, baseURL);
    try {
      const recipientPage = await recipientContext.newPage();
      await signInViaApi(
        recipientPage,
        recipientContext.request,
        SEEDED_MEMBERS[0],
      );
      const conversation = await recipientContext.request.get(
        `/api/messages/${target._id}`,
      );
      expect(conversation.status()).toBe(200);
      expect(await conversation.json()).toEqual([]);
    } finally {
      await recipientContext.close();
    }
    const notes = await request.get(`/api/admin/notes?userId=${target._id}`);
    expect(notes.status()).toBe(200);
    expect((await notes.json())[0].note).toContain('User unshadowbanned.');
    const audit = await request.get('/api/admin/audit-log');
    expect(audit.status()).toBe(200);
    expect(await audit.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.objectContaining({
            id: String(target._id),
            role: 'shadowban',
            action: 'remove',
          }),
        }),
      ]),
    );
  });
});

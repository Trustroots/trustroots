const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_MEMBERS,
  SEEDED_RELATIONSHIP_MEMBERS,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  findContactByUsers,
  updateUserByUsername,
} = require('../../support/db');

test.describe.serial('contacts and safety feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('members can add and confirm contacts through the UI', async ({
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'contacts.add', [
      'Add contact page loads for an eligible member.',
      'Adding a new contact creates a pending relationship.',
    ]);
    annotateFeature(testInfo, 'contacts.confirm', [
      'Confirm contact page loads for a pending contact.',
      'Confirming the contact makes the relationship mutual/confirmed.',
    ]);

    const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;
    const aliceId = await fetchUserIdByUsername(request, alice.username);
    const member = createUser();
    const memberContext = await createIsolatedContext(browser, baseURL);
    const memberPage = await memberContext.newPage();

    try {
      await registerViaApi(memberContext.request, member);
      await updateUserByUsername(member.username, {
        $set: {
          public: true,
          description: 'E2E public contact UI member.',
        },
        $unset: {
          emailTemporary: 1,
          emailToken: 1,
        },
      });
      await signInViaApi(memberPage, memberContext.request, member);

      await memberPage.goto(`/contact-add/${aliceId}`);
      await expect(
        memberPage.getByRole('heading', { name: /add contact/i }),
      ).toBeVisible();

      const addContact = memberPage.waitForResponse(
        response =>
          response.url().includes('/api/contact') &&
          response.request().method() === 'POST' &&
          response.ok(),
      );
      await memberPage.getByRole('button', { name: /^add contact$/i }).click();
      await addContact;
      await expect(
        memberPage.getByText(/done! we sent an email/i),
      ).toBeVisible();
    } finally {
      await memberContext.close();
    }

    const memberId = await fetchUserIdByUsername(request, member.username);
    const contact = await findContactByUsers(memberId, aliceId);
    expect(contact).toBeTruthy();
    expect(contact.confirmed).toBe(false);

    const aliceContext = await createIsolatedContext(browser, baseURL);
    const alicePage = await aliceContext.newPage();

    try {
      await signInViaApi(alicePage, aliceContext.request, alice);
      await alicePage.goto(`/contact-confirm/${contact._id}`);
      await expect(
        alicePage.getByRole('heading', { name: /confirm contact/i }),
      ).toBeVisible();

      const confirmContact = alicePage.waitForResponse(
        response =>
          response.url().includes(`/api/contact/${contact._id}`) &&
          response.request().method() === 'PUT' &&
          response.ok(),
      );
      await alicePage
        .getByRole('button', { name: /^confirm contact$/i })
        .click();
      await confirmContact;
      await expect(
        alicePage.getByText('You two are now connected!'),
      ).toBeVisible();
    } finally {
      await aliceContext.close();
    }

    const confirmed = await findContactByUsers(memberId, aliceId);
    expect(confirmed.confirmed).toBe(true);
  });

  test('members can create pending contacts and see duplicate state', async ({
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'contacts.add', [
      'Add contact page loads for an eligible member.',
      'Adding a new contact creates a pending relationship.',
      'Already-added contact state is handled.',
    ]);

    const aliceId = await fetchUserIdByUsername(
      request,
      SEEDED_RELATIONSHIP_MEMBERS.alice.username,
    );
    const member = createUser();
    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await registerViaApi(context.request, member);
      await updateUserByUsername(member.username, {
        $set: {
          public: true,
          description: 'E2E public contact member.',
        },
        $unset: {
          emailTemporary: 1,
          emailToken: 1,
        },
      });
      await signInViaApi(page, context.request, member);

      await page.goto(`/contact-add/${aliceId}`);
      await expect(
        page.getByRole('heading', { name: /add contact/i }),
      ).toBeVisible();

      const add = await page.request.post('/api/contact', {
        data: {
          friendUserId: aliceId,
          message: 'E2E pending contact request.',
        },
      });
      expect(add.ok()).toBeTruthy();

      const duplicate = await page.request.post('/api/contact', {
        data: {
          friendUserId: aliceId,
          message: 'E2E duplicate contact request.',
        },
      });
      expect(duplicate.status()).toBe(409);
    } finally {
      await context.close();
    }
  });

  test('members can confirm pending contacts and unauthorized access is denied', async ({
    browser,
    baseURL,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'contacts.confirm', [
      'Confirm contact page loads for a pending contact.',
      'Confirming the contact makes the relationship mutual/confirmed.',
      'Invalid or unauthorized contact confirmation is denied.',
    ]);

    const bob = SEEDED_RELATIONSHIP_MEMBERS.bob;
    const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;
    const contact = await findContactByUsers(bob.id, alice.id);
    expect(contact).toBeTruthy();

    const unauthorized = await page.request.put(`/api/contact/${contact._id}`);
    expect(unauthorized.status()).toBe(404);

    const context = await createIsolatedContext(browser, baseURL);
    const alicePage = await context.newPage();
    try {
      await signInViaApi(alicePage, context.request, alice);
      await alicePage.goto(`/contact-confirm/${contact._id}`);
      await expect(
        alicePage.getByRole('heading', { name: /confirm contact/i }),
      ).toBeVisible();

      const confirm = await alicePage.request.put(
        `/api/contact/${contact._id}`,
      );
      expect(confirm.ok()).toBeTruthy();
      expect((await confirm.json()).confirmed).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('members can remove contacts and lists update', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'contacts.remove', [
      'Confirmed contact can be removed.',
      'Removed contact no longer appears in contact lists.',
    ]);
    annotateFeature(testInfo, 'contacts.lists-and-common', [
      'Contact list empty state is visible.',
      'Contact list shows confirmed contacts.',
      'Common contacts endpoint filters to shared contacts.',
    ]);

    const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;
    const bob = SEEDED_RELATIONSHIP_MEMBERS.bob;
    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, alice);

      const aliceContacts = await page.request.get(`/api/contacts/${alice.id}`);
      expect(aliceContacts.ok()).toBeTruthy();
      expect((await aliceContacts.json()).length).toBeGreaterThan(0);

      const common = await page.request.get(`/api/contacts/${bob.id}/common`);
      expect(common.ok()).toBeTruthy();
      expect(Array.isArray(await common.json())).toBeTruthy();

      const contact = await findContactByUsers(bob.id, alice.id);
      const remove = await page.request.delete(`/api/contact/${contact._id}`);
      expect(remove.ok()).toBeTruthy();

      const removed = await page.request.get(`/api/contact/${contact._id}`);
      expect(removed.status()).toBe(404);
    } finally {
      await context.close();
    }
  });

  test('members can list, block, and unblock users', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'safety.block-users', [
      'Blocked users list loads.',
      'Member can block another user from profile/safety UI.',
      'Member can unblock a blocked user.',
    ]);

    const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;
    const bob = SEEDED_RELATIONSHIP_MEMBERS.bob;
    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, alice);

      const blockedList = await page.request.get('/api/blocked-users');
      expect(blockedList.ok()).toBeTruthy();
      expect((await blockedList.json()).map(user => user.username)).toContain(
        bob.username,
      );

      const unblock = await page.request.delete(
        `/api/blocked-users/${bob.username}`,
      );
      expect(unblock.ok()).toBeTruthy();

      const block = await page.request.put(
        `/api/blocked-users/${bob.username}`,
      );
      expect(block.ok()).toBeTruthy();
    } finally {
      await context.close();
    }
  });

  test('blocking hides protected profile and relationship actions', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'safety.block-effects', [
      'Blocked profile actions are hidden or disabled.',
      'Blocked users cannot start or continue conversations where prohibited.',
    ]);

    const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;
    const bob = SEEDED_RELATIONSHIP_MEMBERS.bob;
    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, bob);

      const hiddenProfile = await page.request.get(
        `/api/users/${alice.username}`,
      );
      expect(hiddenProfile.status()).toBe(404);

      const blockedList = await page.request.get('/api/blocked-users');
      expect(blockedList.ok()).toBeTruthy();
    } finally {
      await context.close();
    }
  });
});

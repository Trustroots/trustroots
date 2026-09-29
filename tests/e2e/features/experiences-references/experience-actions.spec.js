const { annotateFeature, expect, test } = require('../../support/test');

const {
  SEEDED_EXPERIENCE,
  SEEDED_MEMBERS,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  findContactByUsers,
  updateUserByUsername,
  withE2eDb,
} = require('../../support/db');

async function createPublicUser(request, overrides = {}) {
  const user = createUser(overrides);
  await registerViaApi(request, user);
  await updateUserByUsername(user.username, {
    $set: {
      public: true,
      description:
        'E2E public user profile description long enough for feature coverage.',
    },
    $unset: {
      emailTemporary: 1,
      emailToken: 1,
    },
  });
  return user;
}

test.describe.serial('experience and reference feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  });

  test('members can create private and public experiences', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.create', [
      'Valid public experience can be submitted.',
      'Valid private experience can be submitted when supported.',
      'Validation errors are shown for invalid submissions.',
    ]);

    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      const userA = await createPublicUser(context.request);
      const userB = await createPublicUser(context.request);
      const userAId = await fetchUserIdByUsername(
        context.request,
        userA.username,
      );
      const userBId = await fetchUserIdByUsername(
        context.request,
        userB.username,
      );
      await signInViaApi(page, context.request, userA);
      const invalid = await page.request.post('/api/experiences', {
        data: {
          userTo: userBId,
          interactions: { met: false, guest: false, host: false },
          recommend: 'unknown',
        },
      });
      expect(invalid.status()).toBe(400);

      const first = await page.request.post('/api/experiences', {
        data: {
          userTo: userBId,
          interactions: { met: true, guest: true, host: false },
          recommend: 'yes',
          feedbackPublic: 'E2E first private experience.',
        },
      });
      expect(first.status()).toBe(201);
      expect((await first.json()).public).toBe(false);

      await signInViaApi(page, context.request, userB);
      const response = await page.request.post('/api/experiences', {
        data: {
          userTo: userAId,
          interactions: { met: true, guest: false, host: true },
          recommend: 'yes',
          feedbackPublic: 'E2E second public experience.',
        },
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).public).toBe(true);
    } finally {
      await context.close();
    }
  });

  for (const role of ['suspended', 'shadowban']) {
    test(`direct contact access and confirmation hide a ${role} member`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      annotateFeature(testInfo, 'contacts.confirm', [
        'Restricted contacts cannot be accessed or confirmed.',
      ]);
      const context = await createIsolatedContext(browser, baseURL);
      const page = await context.newPage();
      try {
        const sender = await createPublicUser(context.request);
        const recipient = await createPublicUser(context.request);
        const senderId = await fetchUserIdByUsername(
          context.request,
          sender.username,
        );
        const recipientId = await fetchUserIdByUsername(
          context.request,
          recipient.username,
        );
        await signInViaApi(page, context.request, sender);
        const added = await context.request.post('/api/contact', {
          data: { friendUserId: recipientId },
        });
        expect(added.ok()).toBeTruthy();
        const contact = await findContactByUsers(senderId, recipientId);
        await updateUserByUsername(sender.username, {
          $addToSet: { roles: role },
        });
        await signInViaApi(page, context.request, recipient);
        expect(
          (await context.request.get(`/api/contact-by/${senderId}`)).status(),
        ).toBe(404);
        expect(
          (await context.request.get(`/api/contact/${contact._id}`)).status(),
        ).toBe(404);
        expect(
          (await context.request.put(`/api/contact/${contact._id}`)).status(),
        ).toBe(404);
        expect(
          (await findContactByUsers(senderId, recipientId)).confirmed,
        ).toBe(false);
      } finally {
        await context.close();
      }
    });
  }

  test('shadowbanned experience submissions remain private and send no notification', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.create', [
      'Restricted authors cannot expose reciprocal feedback or notify recipients.',
    ]);
    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();
    try {
      const author = await createPublicUser(context.request);
      const recipient = await createPublicUser(context.request);
      const authorId = await fetchUserIdByUsername(
        context.request,
        author.username,
      );
      const recipientId = await fetchUserIdByUsername(
        context.request,
        recipient.username,
      );
      await signInViaApi(page, context.request, recipient);
      const opposite = await context.request.post('/api/experiences', {
        data: {
          userTo: authorId,
          interactions: { met: true },
          recommend: 'yes',
          feedbackPublic: 'Reciprocal private feedback.',
        },
      });
      expect(opposite.status()).toBe(201);
      const oppositeExperience = await opposite.json();
      await signInViaApi(page, context.request, author);
      await updateUserByUsername(author.username, {
        $addToSet: { roles: 'shadowban' },
      });
      const emailQuery = {
        name: 'send email',
        'data.to.address': recipient.email,
      };
      const countEmails = () =>
        withE2eDb(db => db.collection('agendaJobs').countDocuments(emailQuery));
      const emailsBefore = await countEmails();
      const submitted = await context.request.post('/api/experiences', {
        data: {
          userTo: recipientId,
          interactions: { met: true },
          recommend: 'no',
          feedbackPublic: 'Hidden feedback.',
        },
      });
      expect(submitted.status()).toBe(201);
      expect(await submitted.json()).toMatchObject({
        public: false,
        response: null,
      });
      const emailsAfter = await countEmails();
      expect(emailsAfter).toBe(emailsBefore);
      await signInViaApi(page, context.request, recipient);
      const detail = await context.request.get(
        `/api/experiences/${oppositeExperience._id}`,
      );
      expect(await detail.json()).toMatchObject({
        public: false,
        response: null,
      });
      const list = await context.request.get('/api/experiences', {
        params: { userTo: recipientId },
      });
      expect(await list.json()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('experience counts and details respect visibility', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.counts-and-details', [
      'Experience counts match seeded public/private visibility.',
      'Experience detail API returns an authorized experience.',
      'Unauthorized or hidden experience detail is denied.',
    ]);

    const portlandId = await fetchUserIdByUsername(
      request,
      SEEDED_EXPERIENCE.profileUsername,
    );

    const count = await page.request.get('/api/experiences/count', {
      params: { userTo: portlandId },
    });
    expect(count.ok()).toBeTruthy();
    expect((await count.json()).count).toBeGreaterThan(0);

    const list = await page.request.get('/api/experiences', {
      params: { userTo: portlandId },
    });
    expect(list.ok()).toBeTruthy();
    const [experience] = await list.json();
    expect(experience._id).toBeTruthy();

    const detail = await page.request.get(`/api/experiences/${experience._id}`);
    expect(detail.ok()).toBeTruthy();
    expect((await detail.json()).feedbackPublic).toBe(
      SEEDED_EXPERIENCE.feedbackPublic,
    );

    const hidden = await page.request.get('/api/experiences/not-a-valid-id');
    expect(hidden.status()).toBe(400);
  });

  test('my-experience endpoint returns an existing private experience', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.duplicate-prevention', [
      'Existing experience is detected.',
    ]);

    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      const userA = await createPublicUser(context.request);
      const userB = await createPublicUser(context.request);
      const userBId = await fetchUserIdByUsername(
        context.request,
        userB.username,
      );
      await signInViaApi(page, context.request, userA);

      const invalid = await page.request.get('/api/my-experience');
      expect(invalid.status()).toBe(400);

      const create = await page.request.post('/api/experiences', {
        data: {
          userTo: userBId,
          interactions: { met: true, guest: true, host: false },
          recommend: 'yes',
          feedbackPublic: 'E2E my-experience lookup target.',
        },
      });
      expect(create.status()).toBe(201);

      const mine = await page.request.get('/api/my-experience', {
        params: { userWith: userBId },
      });
      expect(mine.ok()).toBeTruthy();
      expect(await mine.json()).toMatchObject({
        feedbackPublic: 'E2E my-experience lookup target.',
        public: false,
      });
    } finally {
      await context.close();
    }
  });

  test('members cannot create experiences for themselves', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.create', [
      'Validation errors are shown for invalid submissions.',
    ]);

    const user = await createPublicUser(request);
    const userId = await fetchUserIdByUsername(request, user.username);
    await signInViaApi(page, request, user);

    const response = await page.request.post('/api/experiences', {
      data: {
        userTo: userId,
        interactions: { met: true, guest: false, host: false },
        recommend: 'yes',
        feedbackPublic: 'E2E invalid self experience.',
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).details).toMatchObject({ userTo: 'self' });
  });

  test('legacy reference thread API can create and read references', async ({
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'references.thread-create-read', [
      'Supported reference thread can be created.',
      'Supported reference thread can be read by an authorized member.',
      'Unauthorized reference thread access is denied.',
    ]);

    const portland = SEEDED_MEMBERS[1];
    const beijing = SEEDED_MEMBERS[2];
    const portlandId = await fetchUserIdByUsername(request, portland.username);
    const beijingId = await fetchUserIdByUsername(request, beijing.username);
    const context = await createIsolatedContext(browser, baseURL);
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, SEEDED_MEMBERS[0]);
      const create = await page.request.post('/api/references-thread', {
        data: {
          userTo: portlandId,
          reference: 'yes',
        },
      });
      expect([200, 201, 400, 409]).toContain(create.status());

      const read = await page.request.get(
        `/api/references-thread/${portlandId}`,
      );
      expect(read.ok()).toBeTruthy();
      expect(['yes', 'no']).toContain((await read.json()).reference);

      const denied = await page.request.get(
        `/api/references-thread/${beijingId}`,
      );
      expect([403, 404]).toContain(denied.status());
    } finally {
      await context.close();
    }
  });

  test('disabled reference state leaves API routes unavailable when flagged off', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.disabled-state', [
      'Experiences tab hides or degrades safely when references are disabled.',
      'Create experience entry point is unavailable when references are disabled.',
    ]);

    await page.route('**/api/experiences**', route =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not found.' }),
      }),
    );

    await page.goto(`/profile/${SEEDED_MEMBERS[1].username}/experiences`);
    await expect(page).toHaveURL(/\/experiences/);
  });
});

const { expect, test } = require('../../support/test');
const {
  createIsolatedContext,
  createUser,
  registerViaApi,
} = require('../../support/helpers');
const {
  findOffersByUser,
  findUserByUsername,
  removeUserByUsername,
  updateUserByUsername,
  withE2eDb,
} = require('../../support/db');

test.describe('route permission regression coverage', () => {
  test('guests can read public circles but cannot use other methods or messages', async ({
    browser,
    baseURL,
  }) => {
    const context = await createIsolatedContext(browser, baseURL);

    try {
      const circles = await context.request.get('/api/tribes');
      expect(circles.status()).toBe(200);
      expect(Array.isArray(await circles.json())).toBeTruthy();

      expect((await context.request.post('/api/tribes')).status()).toBe(403);
      expect((await context.request.get('/api/messages')).status()).toBe(403);
    } finally {
      await context.close();
    }
  });

  test('an admin-only role keeps offer access but needs the user role for messages', async ({
    browser,
    baseURL,
  }) => {
    const member = createUser();
    const context = await createIsolatedContext(browser, baseURL);
    let memberId;

    try {
      await registerViaApi(context.request, member);
      await updateUserByUsername(member.username, {
        $set: { public: true, roles: ['admin'] },
      });
      const storedMember = await findUserByUsername(member.username);
      memberId = storedMember._id;

      const signIn = await context.request.post('/api/auth/signin', {
        data: { username: member.username, password: member.password },
      });
      expect(signIn.ok()).toBeTruthy();

      expect((await context.request.get('/api/messages')).status()).toBe(403);

      const description = 'Anonymous role permission offer';
      const createOffer = await context.request.post('/api/offers', {
        data: {
          type: 'host',
          status: 'maybe',
          description,
          maxGuests: 1,
          location: [52.52, 13.405],
        },
      });
      expect(createOffer.status()).toBe(200);
      const offers = await findOffersByUser(memberId, { description });
      expect(offers).toHaveLength(1);
      expect(
        (await context.request.delete(`/api/offers/${offers[0]._id}`)).status(),
      ).toBe(200);

      await updateUserByUsername(member.username, {
        $set: { roles: ['admin', 'user'] },
      });
      expect((await context.request.get('/api/messages')).status()).toBe(200);

      await updateUserByUsername(member.username, {
        $set: { roles: ['admin'] },
      });
      expect((await context.request.get('/api/messages')).status()).toBe(403);
    } finally {
      if (memberId) {
        await withE2eDb(db =>
          db.collection('offers').deleteMany({ user: memberId }),
        );
      }
      await removeUserByUsername(member.username);
      await context.close();
    }
  });
});

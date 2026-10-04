const { annotateFeature, expect, test } = require('../../support/test');
const {
  SEEDED_ADMIN,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const { updateUserByUsername } = require('../../support/db');

async function createPublicUser(request) {
  const user = createUser();
  await registerViaApi(request, user);
  await updateUserByUsername(user.username, {
    $set: {
      public: true,
      description: 'An anonymous profile description for Experience review.',
    },
    $unset: { emailTemporary: 1, emailToken: 1 },
  });
  return user;
}

test('support link lets an author request an edit and removal for admin review', async ({
  browser,
  baseURL,
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'experiences.change-requests', [
    'Admin generates a scoped support link.',
    'Author proposes an edit that stays pending until approval.',
    'Approved edit appears on the profile.',
    'Approved removal hides the Experience.',
  ]);

  const memberContext = await createIsolatedContext(browser, baseURL);
  const memberPage = await memberContext.newPage();

  try {
    const author = await createPublicUser(memberContext.request);
    const recipient = await createPublicUser(memberContext.request);
    const authorId = await fetchUserIdByUsername(
      memberContext.request,
      author.username,
    );
    const recipientId = await fetchUserIdByUsername(
      memberContext.request,
      recipient.username,
    );

    await signInViaApi(memberPage, memberContext.request, author);
    const created = await memberPage.request.post('/api/experiences', {
      data: {
        userTo: recipientId,
        interactions: { met: true, guest: false, host: false },
        recommend: 'yes',
        feedbackPublic: 'An anonymous original Experience.',
      },
    });
    expect(created.status()).toBe(201);
    const experience = await created.json();

    await signInViaApi(memberPage, memberContext.request, recipient);
    const reciprocal = await memberPage.request.post('/api/experiences', {
      data: {
        userTo: authorId,
        interactions: { met: true, guest: false, host: false },
        recommend: 'yes',
        feedbackPublic: 'An anonymous reciprocal Experience.',
      },
    });
    expect(reciprocal.status()).toBe(201);

    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto('/admin/experience-changes');
    await page.getByLabel('Member username').fill(author.username);
    await page.getByRole('button', { name: 'Find Experiences' }).click();
    await expect(
      page.getByText('An anonymous original Experience.'),
    ).toBeVisible();
    await page
      .locator('.panel')
      .filter({ hasText: 'An anonymous original Experience.' })
      .getByRole('button', { name: 'Copy link for author' })
      .click();
    const link = await page
      .getByLabel('Support link (expires in seven days)')
      .inputValue();
    expect(link).toContain(`experiences/${experience._id}/change?secret=`);

    await signInViaApi(memberPage, memberContext.request, author);
    await memberPage.goto(link);
    await expect(
      memberPage.getByRole('heading', { name: 'Propose an edit' }),
    ).toBeVisible();
    await memberPage
      .getByLabel('Written feedback')
      .fill('An anonymous revised Experience.');
    await memberPage.getByLabel('Recommendation').selectOption('no');
    await memberPage.getByRole('button', { name: 'Request edit' }).click();
    await expect(memberPage.getByRole('status')).toContainText(
      'awaiting admin review',
    );

    const pending = await memberPage.request.get(
      `/api/experiences/${experience._id}`,
    );
    expect((await pending.json()).feedbackPublic).toBe(
      'An anonymous original Experience.',
    );

    await page.reload();
    await expect(
      page.getByText('An anonymous revised Experience.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).first().click();
    await memberPage.reload();
    await expect(memberPage.getByRole('status')).toContainText('approved');

    const edited = await memberPage.request.get(
      `/api/experiences/${experience._id}`,
    );
    expect((await edited.json()).feedbackPublic).toBe(
      'An anonymous revised Experience.',
    );

    await memberPage.getByRole('button', { name: 'Request removal' }).click();
    await expect(memberPage.getByRole('status')).toContainText(
      'awaiting admin review',
    );
    await page.reload();
    await page.getByRole('button', { name: 'Approve' }).first().click();
    await memberPage.reload();
    await expect(memberPage.getByRole('status')).toContainText('approved');
    expect(
      (
        await memberPage.request.get(`/api/experiences/${experience._id}`)
      ).status(),
    ).toBe(404);
  } finally {
    await memberContext.close();
  }
});
